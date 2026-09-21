import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type {
  ClockCalibration,
  Confidence,
  PersistState,
  RaceLeg,
  VersionSnapshot,
} from "../domain/types";
import { seedState } from "../domain/seed";
import { toUtcMs } from "../domain/model";

const STATE_KEY = "pigeon-recheck-state-v1";
const SNAP_KEY = "pigeon-recheck-snapshots-v1";

interface StoreBundle {
  state: PersistState;
  snapshots: VersionSnapshot[];
  // 判定参数变更（先冻结旧版，再重算）
  applyParamChange: (
    next: PersistState,
    reason: string,
    opts?: { freeze?: boolean }
  ) => void;
  addLeg: (leg: RaceLeg) => { ok: boolean; message: string };
  addPunch: (legId: string, punch: RaceLeg["punches"][number]) => void;
  removePunch: (legId: string, punchId: string) => void;
  removeLeg: (legId: string) => void;
  addReview: (
    legId: string,
    reviewerId: string,
    confidence: Confidence,
    reason: string,
    issueSignature: string
  ) => { ok: boolean; message: string };
  resetAll: () => void;
}

const StoreContext = createContext<StoreBundle | null>(null);

function loadState(): PersistState {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (raw) return JSON.parse(raw) as PersistState;
  } catch {
    /* ignore */
  }
  return seedState();
}

function loadSnapshots(): VersionSnapshot[] {
  try {
    const raw = localStorage.getItem(SNAP_KEY);
    if (raw) return JSON.parse(raw) as VersionSnapshot[];
  } catch {
    /* ignore */
  }
  return [];
}

let idCounter = 0;
export function uid(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter}`;
}

/** 赛程唯一键：足环号 + 放飞时刻 + 放飞地点 */
export function legKey(
  ringId: string,
  siteId: string,
  releaseLocal: string
): string {
  return `${ringId}|${siteId}|${releaseLocal}`;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PersistState>(loadState);
  const [snapshots, setSnapshots] = useState<VersionSnapshot[]>(loadSnapshots);

  useEffect(() => {
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    localStorage.setItem(SNAP_KEY, JSON.stringify(snapshots));
  }, [snapshots]);

  const applyParamChange = useCallback(
    (next: PersistState, reason: string, opts?: { freeze?: boolean }) => {
      const freeze = opts?.freeze ?? true;
      if (freeze) {
        // 旧版冻结：变更前的完整档案 + 派生结果可重放（数据自足，只读）
        setSnapshots((prev) => {
          const snapshot: VersionSnapshot = {
            version: state.version,
            frozenAt: Date.now(),
            reason,
            data: JSON.parse(JSON.stringify(state)) as PersistState,
          };
          return [snapshot, ...prev].slice(0, 30);
        });
        setState({ ...next, version: state.version + 1 });
      } else {
        setState(next);
      }
    },
    [state]
  );

  const addLeg = useCallback(
    (leg: RaceLeg): { ok: boolean; message: string } => {
      // 唯一赛程校验
      const key = legKey(leg.ringId, leg.siteId, leg.releaseLocal);
      const dup = state.legs.some(
        (l) => legKey(l.ringId, l.siteId, l.releaseLocal) === key
      );
      if (dup)
        return {
          ok: false,
          message: "同一足环、同一放飞时刻与地点的赛程已存在（赛程唯一键冲突）",
        };
      const site = state.sites.find((s) => s.id === leg.siteId);
      if (site && Number.isNaN(toUtcMs(leg.releaseLocal, site.offsetMin)))
        return { ok: false, message: "放飞时刻格式不正确" };
      setState((s) => ({ ...s, legs: [...s.legs, leg] }));
      return { ok: true, message: "赛程已建立，报时链开始复测" };
    },
    [state.legs, state.sites]
  );

  // 新增报时：可能引入/消除矛盾，矛盾指纹随之变化，旧复核自动失效；不产生版本快照
  const addPunch = useCallback(
    (legId: string, punch: RaceLeg["punches"][number]) => {
      setState((s) => ({
        ...s,
        legs: s.legs.map((l) =>
          l.id === legId
            ? {
                ...l,
                punches: [
                  ...l.punches,
                  { ...punch, cumKm: +punch.cumKm },
                ].sort((a, b) =>
                  (a.clockLocal || "").localeCompare(b.clockLocal || "")
                ),
              }
            : l
        ),
      }));
    },
    []
  );

  const removePunch = useCallback((legId: string, punchId: string) => {
    setState((s) => ({
      ...s,
      legs: s.legs.map((l) =>
        l.id === legId
          ? { ...l, punches: l.punches.filter((p) => p.id !== punchId) }
          : l
      ),
    }));
  }, []);

  const removeLeg = useCallback((legId: string) => {
    setState((s) => ({
      ...s,
      legs: s.legs.filter((l) => l.id !== legId),
      reviews: s.reviews.filter((r) => r.legId !== legId),
    }));
  }, []);

  const addReview = useCallback(
    (
      legId: string,
      reviewerId: string,
      confidence: Confidence,
      reason: string,
      issueSignature: string
    ): { ok: boolean; message: string } => {
      if (!reason.trim()) return { ok: false, message: "请填写复核原因" };
      // 重复提请沿用首条：同一赛程 + 同一复核人 + 同一矛盾指纹已存在则拒绝；
      // 若报时/参数变化导致矛盾指纹更新，旧复核转为失效，允许针对新问题重新提请。
      const exists = state.reviews.some(
        (r) =>
          r.legId === legId &&
          r.reviewerId === reviewerId &&
          r.issueSignature === issueSignature
      );
      if (exists)
        return {
          ok: false,
          message: "该复核人已对此矛盾提请过置信档，重复提请沿用首条",
        };
      setState((s) => ({
        ...s,
        reviews: [
          ...s.reviews,
          {
            id: uid("rv"),
            legId,
            reviewerId,
            confidence,
            reason: reason.trim(),
            at: Date.now(),
            issueSignature,
          },
        ],
      }));
      return { ok: true, message: "置信档已提交，等待一致解冻" };
    },
    [state.reviews]
  );

  const resetAll = useCallback(() => {
    const fresh = seedState();
    setState(fresh);
    setSnapshots([]);
  }, []);

  const value = useMemo<StoreBundle>(
    () => ({
      state,
      snapshots,
      applyParamChange,
      addLeg,
      addPunch,
      removePunch,
      removeLeg,
      addReview,
      resetAll,
    }),
    [
      state,
      snapshots,
      applyParamChange,
      addLeg,
      addPunch,
      removePunch,
      removeLeg,
      addReview,
      resetAll,
    ]
  );

  return (
    <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
  );
}

export function useStore(): StoreBundle {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}

/** 派生分析所需的便捷选择器 */
export function findRefs(state: PersistState) {
  const ringById = new Map(state.rings.map((r) => [r.id, r]));
  const siteById = new Map(state.sites.map((s) => [s.id, s]));
  const clockById = new Map(state.clocks.map((c) => [c.id, c]));
  return { ringById, siteById, clockById };
}
