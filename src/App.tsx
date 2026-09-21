import { useEffect, useMemo, useState } from "react";
import "./styles.css";
import type { BirdProfile, Race, Review, ReviewVote } from "./types";
import {
  analyzeRace,
  effectiveAvgSpeed,
  effectiveHomed,
  reviewDisposition,
  raceSignature,
  profileSignature,
} from "./lib/analyze";
import { buildSeedProfiles, buildSeedRaces } from "./lib/seed";
import {
  loadState,
  saveState,
  clearState,
  type ArchivedReview,
  type PersistState,
  type ReadOnlySnapshot,
} from "./lib/storage";
import { nowIso } from "./lib/time";
import { distanceBand, fmtKm, fmtMinutes, fmtSpeed, shortIso } from "./lib/format";
import { Timeline } from "./components/Timeline";
import { ReviewPanel, createReview } from "./components/ReviewPanel";
import { RaceEditor } from "./components/RaceEditor";
import { PairingPanel } from "./components/PairingPanel";
import { ProfilePanel } from "./components/ProfilePanel";
import { ArchivePanel } from "./components/ArchivePanel";

type Tab = "ranking" | "disputes" | "unhomed" | "profiles" | "archive";

const TABS: { key: Tab; label: string }[] = [
  { key: "ranking", label: "可信排行" },
  { key: "disputes", label: "争议复核队列" },
  { key: "unhomed", label: "未归巢" },
  { key: "profiles", label: "足环档案 / 配对" },
  { key: "archive", label: "旧版只读" },
];

const BANDS = ["全部", "短距离", "中距离", "长距离"] as const;

function initialState(): PersistState {
  const loaded = loadState();
  if (loaded) return loaded;
  return {
    races: buildSeedRaces(),
    profiles: buildSeedProfiles(),
    reviews: {},
    archivedReviews: [],
    snapshots: [],
  };
}

export default function App() {
  const [state, setState] = useState<PersistState>(initialState);
  const [tab, setTab] = useState<Tab>("ranking");
  const [selectedId, setSelectedId] = useState<string | null>(
    state.races[0]?.id ?? null
  );
  const [band, setBand] = useState<(typeof BANDS)[number]>("全部");
  const [bloodline, setBloodline] = useState<string>("全部");

  // 持久化：刷新后赛程、争议队列、时间轴一致
  useEffect(() => {
    saveState(state);
  }, [state]);

  // 派生：对每羽赛程按当前签名分析；签名不匹配的复核在下方 effect 中转归档（旧版只读）
  const analyses = useMemo(() => {
    return state.races.map((race) => {
      const sig = raceSignature(race);
      const existing = state.reviews[race.id];
      const live =
        existing && existing.issueSignature === sig ? existing : null;
      return analyzeRace(race, live);
    });
  }, [state.races, state.reviews]);

  // 参数（时区 / 放飞时刻地点 / 鸽钟校准 / 报点）一变 → 旧复核结论失效，转只读留痕
  useEffect(() => {
    const stale: ArchivedReview[] = [];
    const next: Record<string, Review> = {};
    for (const race of state.races) {
      const sig = raceSignature(race);
      const rv = state.reviews[race.id];
      if (rv && rv.issueSignature === sig) next[race.id] = rv;
      else if (rv)
        stale.push({
          id: `${race.id}-${Date.now().toString(36)}-${Math.random()
            .toString(36)
            .slice(2, 7)}`,
          raceId: race.id,
          ringNo: race.ringNo,
          review: rv,
          archivedAt: nowIso(),
          reason:
            "放飞地时区 / 放飞时刻地点 / 鸽钟校准 / 报时数据变更，签名失效",
        });
    }
    if (stale.length > 0) {
      setState((s) => ({
        ...s,
        reviews: next,
        archivedReviews: [...stale, ...s.archivedReviews].slice(0, 100),
      }));
    }
  }, [state.races, state.reviews]);

  const byId = useMemo(() => {
    const m = new Map(analyses.map((a) => [a.race.id, a]));
    return m;
  }, [analyses]);

  const analysesByRing = useMemo(
    () => new Map(analyses.map((a) => [a.race.ringNo, a])),
    [analyses]
  );

  const pfVersion = useMemo(
    () => profileSignature(state.profiles),
    [state.profiles]
  );

  const bloodlines = useMemo(
    () => ["全部", ...Array.from(new Set(state.races.map((r) => r.bloodline)))],
    [state.races]
  );

  // 三个互斥队列
  const ranked = useMemo(() => {
    return analyses
      .filter((a) => effectiveHomed(a))
      .map((a) => ({ a, speed: effectiveAvgSpeed(a) ?? 0 }))
      .sort((x, y) => y.speed - x.speed);
  }, [analyses]);

  const disputed = useMemo(
    () => analyses.filter((a) => !a.homed && reviewDisposition(a) !== "accepted" && a.firstDisputeIndex >= 0),
    [analyses]
  );

  const unhomed = useMemo(
    () =>
      analyses.filter(
        (a) =>
          !effectiveHomed(a) &&
          a.firstDisputeIndex < 0 &&
          a.race.reports.length > 0 &&
          !a.race.reports.some((r) => r.home)
      ),
    [analyses]
  );

  const total = analyses.length || 1;
  const homedCount = ranked.length;
  const pendingReviews = analyses.filter((a) => a.review && a.review.status !== "unfrozen").length;
  const acceptedCount = analyses.filter((a) => reviewDisposition(a) === "accepted").length;

  const selected = selectedId ? byId.get(selectedId) ?? null : null;
  const selectedRace = selected?.race ?? null;

  /* ---------------- 状态操作 ---------------- */

  const saveRace = (race: Race) => {
    setState((s) => {
      const exists = s.races.some((r) => r.id === race.id);
      return {
        ...s,
        races: exists
          ? s.races.map((r) => (r.id === race.id ? race : r))
          : [...s.races, race],
      };
    });
    setSelectedId(race.id);
  };

  const deleteRace = (id: string) =>
    setState((s) => {
      const { [id]: _rv, ...reviews } = s.reviews;
      const races = s.races.filter((r) => r.id !== id);
      return { ...s, races, reviews };
    });

  const addRace = () => {
    const t = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const stamp = `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}T${pad(t.getHours())}:${pad(t.getMinutes())}`;
    const id = `race-${Date.now().toString(36)}`;
    const race: Race = {
      id,
      ringNo: "CHN-NEW-000000",
      bloodline: "",
      releaseName: "新放飞点",
      releaseLat: 39.9,
      releaseLng: 116.4,
      timeZone: "Asia/Shanghai",
      releaseTime: stamp,
      speedLimitMpm: 1500,
      reports: [],
    };
    setState((s) => ({ ...s, races: [...s.races, race] }));
    setSelectedId(id);
  };

  // 复核：重复提请沿用首条；两票一致才解冻
  const submitVote = (who: "A" | "B", vote: ReviewVote) => {
    if (!selected) return;
    setState((s) => {
      const sig = selected.signature;
      const prev =
        s.reviews[selected.race.id] &&
        s.reviews[selected.race.id].issueSignature === sig
          ? s.reviews[selected.race.id]
          : createReview(selected.race.id, sig);

      const next: Review = {
        ...prev,
        reviewerA: who === "A" ? vote : prev.reviewerA,
        reviewerB: who === "B" ? vote : prev.reviewerB,
        status: "pending",
      };

      if (next.reviewerA && next.reviewerB) {
        next.status =
          next.reviewerA.level === next.reviewerB.level ? "unfrozen" : "pending";
        next.lastResultAt = nowIso();
      }

      return { ...s, reviews: { ...s.reviews, [selected.race.id]: next } };
    });
  };

  const resetReview = () => {
    if (!selected) return;
    setState((s) => {
      const old = s.reviews[selected.race.id];
      const archived: ArchivedReview[] = old
        ? [
            {
              id: `${selected.race.id}-reset-${Date.now().toString(36)}`,
              raceId: selected.race.id,
              ringNo: selected.race.ringNo,
              review: old,
              archivedAt: nowIso(),
              reason: "人工撤回复核、重开争议",
            },
            ...s.archivedReviews,
          ].slice(0, 100)
        : s.archivedReviews;
      const { [selected.race.id]: _x, ...rest } = s.reviews;
      return { ...s, reviews: rest, archivedReviews: archived };
    });
  };

  const saveProfiles = (profiles: BirdProfile[]) =>
    setState((s) => ({ ...s, profiles }));

  const createSnapshot = (label: string) =>
    setState((s) => ({
      ...s,
      snapshots: [
        {
          id: `snap-${Date.now().toString(36)}`,
          label,
          createdAt: nowIso(),
          races: JSON.parse(JSON.stringify(s.races)),
          reviews: JSON.parse(JSON.stringify(s.reviews)),
        },
        ...s.snapshots,
      ].slice(0, 30),
    }));

  const resetAll = () => {
    if (!confirm("清空全部本地数据并恢复示例？此操作不可撤销。")) return;
    clearState();
    const seed = {
      races: buildSeedRaces(),
      profiles: buildSeedProfiles(),
      reviews: {},
      archivedReviews: [],
      snapshots: [],
    };
    setState(seed);
    setSelectedId(seed.races[0].id);
  };

  /* ---------------- 渲染辅助 ---------------- */

  const passesFilter = (a: (typeof analyses)[number]) => {
    if (band !== "全部" && distanceBand(a.totalKm) !== band) return false;
    if (bloodline !== "全部" && a.race.bloodline !== bloodline) return false;
    return true;
  };

  const cardBadges = (a: (typeof analyses)[number]) => {
    const tags: { cls: string; text: string }[] = [];
    const dep = reviewDisposition(a);
    if (a.homed) tags.push({ cls: "ok", text: "全程可信归巢" });
    else if (dep === "accepted") tags.push({ cls: "info", text: "复核解冻采信" });
    else if (a.firstDisputeIndex >= 0)
      tags.push({
        cls: "danger",
        text: `争议自段${a.firstDisputeIndex + 1}`,
      });
    if (a.review?.status === "pending") tags.push({ cls: "warn", text: "缺第二票" });
    else if (
      a.review?.status === "frozen" &&
      (a.review.reviewerA || a.review.reviewerB)
    )
      tags.push({ cls: "warn", text: "待第二票" });
    else if (a.firstDisputeIndex >= 0)
      tags.push({ cls: "muted", text: "待提请" });
    if (dep === "rejected") tags.push({ cls: "warn", text: "双低维持不计" });
    return tags;
  };

  const RaceCard = ({
    a,
    rankNo,
    onClick,
  }: {
    a: (typeof analyses)[number];
    rankNo?: number;
    onClick: () => void;
  }) => (
    <article
      className={`race-card ${selectedId === a.race.id ? "selected" : ""}`}
      onClick={onClick}
    >
      <div className="rank-no">{rankNo ? rankNo : "!"}</div>
      <div>
        <h3>
          {a.race.ringNo}
          <span className="muted" style={{ fontWeight: 400, marginLeft: 8 }}>
            {a.race.bloodline}
          </span>
        </h3>
        <div className="race-meta">
          <span>{a.race.releaseName}</span>
          <span>{distanceBand(a.totalKm)}</span>
          <span>
            可信 {fmtKm(a.trustedKm)} / 全程 {fmtKm(a.totalKm)}
          </span>
          <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {cardBadges(a).map((t) => (
              <span key={t.text} className={`badge ${t.cls}`}>
                {t.text}
              </span>
            ))}
          </span>
        </div>
      </div>
      <div className="race-stats">
        <span className="speed">
          {effectiveHomed(a)
            ? fmtSpeed(effectiveAvgSpeed(a))
            : fmtSpeed(a.avgSpeedMpm)}
        </span>
        <small>用时 {fmtMinutes(a.trustedMinutes)}</small>
      </div>
    </article>
  );

  return (
    <main className="app">
      <section className="hero panel" style={{ borderRadius: 10 }}>
        <div>
          <p className="eyebrow">离线航迹可信度复测台 · PIGEON TRACK RE-TEST BENCH</p>
          <h1>赛鸽训放 · 多段鸽钟报时矛盾筛查与双人复核</h1>
          <p className="desc">
            每羽按「足环号 × 放飞时刻 × 放飞地点」形成唯一赛程；鸽钟报时按递增时刻、分段限速与累计航距逐段筛查，
            连续可信段进入排行，争议段冻结、不计未归巢。放飞地时区、鸽钟校准或足环档案一变，排行 / 风险 / 配对提示即刻失效重算，
            旧版只读留痕；两名复核人各交置信档与原因，一致才解冻。
          </p>
        </div>
        <div className="hero-side">
          <span className="recalc">
            <span className="dot" /> 离线引擎已重算（{analyses.length} 羽）
          </span>
          <button onClick={addRace}>+ 新建赛程</button>
          <button className="ghost danger" onClick={resetAll}>
            恢复示例数据
          </button>
        </div>
      </section>

      <section className="metrics">
        <article>
          <small>归巢率（全程可信 / 解冻采信）</small>
          <strong>
            {homedCount}/{analyses.length}
          </strong>
          <small className="sub">{Math.round((homedCount / total) * 100)}%</small>
        </article>
        <article>
          <small>争议赛程（冻结中）</small>
          <strong>{disputed.length}</strong>
          <small className="sub">其中 {pendingReviews} 个待复核</small>
        </article>
        <article>
          <small>在飞未归巢</small>
          <strong>{unhomed.length}</strong>
          <small className="sub">无矛盾、归巢点未报</small>
        </article>
        <article>
          <small>解冻采信 / 足环档案</small>
          <strong>
            {acceptedCount}/{state.profiles.length}
          </strong>
          <small className="sub">双高一致才进排行</small>
        </article>
      </section>

      <div className="tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={tab === t.key ? "active" : ""}
            onClick={() => setTab(t.key)}
          >
            {t.label}
            {t.key === "disputes" && disputed.length > 0 && ` (${disputed.length})`}
            {t.key === "unhomed" && unhomed.length > 0 && ` (${unhomed.length})`}
          </button>
        ))}
      </div>

      {tab !== "profiles" && tab !== "archive" && (
        <div className="filterbar">
          <span className="label">里程</span>
          {BANDS.map((b) => (
            <button
              key={b}
              className={band === b ? "active" : ""}
              onClick={() => setBand(b)}
            >
              {b}
            </button>
          ))}
          <span className="label" style={{ marginLeft: 10 }}>
            血统
          </span>
          <select
            style={{ width: 150 }}
            value={bloodline}
            onChange={(e) => setBloodline(e.target.value)}
          >
            {bloodlines.map((b) => (
              <option key={b}>{b}</option>
            ))}
          </select>
        </div>
      )}

      <div className="layout">
        <div className="stack">
          {tab === "ranking" && (
            <section className="panel">
              <div className="section-title">
                <div>
                  <h2>可信排行</h2>
                  <p>仅收录连续可信段抵达归巢点、或双高置信解冻采信的赛程，按均速降序</p>
                </div>
              </div>
              <div className="rank-list">
                {ranked.filter(({ a }) => passesFilter(a)).length === 0 && (
                  <div className="empty">暂无符合筛选的可信归巢赛程</div>
                )}
                {ranked
                  .filter(({ a }) => passesFilter(a))
                  .map(({ a }, i) => (
                    <RaceCard
                      key={a.race.id}
                      a={a}
                      rankNo={i + 1}
                      onClick={() => setSelectedId(a.race.id)}
                    />
                  ))}
              </div>
            </section>
          )}

          {tab === "disputes" && (
            <section className="panel">
              <div className="section-title">
                <div>
                  <h2>争议复核队列</h2>
                  <p>首个矛盾段及其后全部冻结，不计未归巢；两名复核人一致才解冻</p>
                </div>
              </div>
              <div className="rank-list">
                {disputed.filter(passesFilter).length === 0 && (
                  <div className="empty">争议队列已清空，全部赛程连续可信</div>
                )}
                {disputed.filter(passesFilter).map((a) => (
                  <div key={a.race.id} className="stack" style={{ gap: 8 }}>
                    <RaceCard a={a} rankNo={0} onClick={() => setSelectedId(a.race.id)} />
                    <div
                      style={{
                        padding: "0 16px 10px",
                        display: "grid",
                        gap: 6,
                      }}
                    >
                      {a.issues
                        .filter((is) => is.segmentIndex >= a.firstDisputeIndex)
                        .slice(0, 3)
                        .map((is) => (
                          <p
                            key={`${is.segmentIndex}-${is.kind}`}
                            className="muted"
                            style={{ margin: 0, color: "#b91c1c" }}
                          >
                            · 段{is.segmentIndex + 1}：{is.detail}
                          </p>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {tab === "unhomed" && (
            <section className="panel">
              <div className="section-title">
                <div>
                  <h2>未归巢（在飞 / 归巢未确认）</h2>
                  <p>连续可信但归巢点尚未报时；争议赛程不计入本列表</p>
                </div>
              </div>
              <div className="rank-list">
                {unhomed.filter(passesFilter).length === 0 && (
                  <div className="empty">无未归巢赛程</div>
                )}
                {unhomed.filter(passesFilter).map((a) => (
                  <RaceCard
                    key={a.race.id}
                    a={a}
                    rankNo={0}
                    onClick={() => setSelectedId(a.race.id)}
                  />
                ))}
              </div>
            </section>
          )}

          {tab === "profiles" && (
            <ProfilePanel profiles={state.profiles} onChange={saveProfiles} />
          )}

          {tab === "archive" && (
            <ArchivePanel
              archived={state.archivedReviews}
              snapshots={state.snapshots}
              onCreateSnapshot={createSnapshot}
              onRemoveSnapshot={(id) =>
                setState((s) => ({
                  ...s,
                  snapshots: s.snapshots.filter((x) => x.id !== id),
                }))
              }
              onClearArchived={() =>
                setState((s) => ({ ...s, archivedReviews: [] }))
              }
            />
          )}
        </div>

        {/* 右栏：选中赛程详情 */}
        <div className="stack">
          {selected && selectedRace ? (
            <>
              <section className="panel">
                <div className="section-title">
                  <div>
                    <h2>{selected.race.ringNo}</h2>
                    <p>
                      {selected.race.releaseName} · 档案签名 {pfVersion.slice(0, 8)} ·
                      赛程签名 {selected.signature.slice(4, 12)}
                    </p>
                  </div>
                </div>
                <dl className="kv">
                  <dt>结论</dt>
                  <dd>
                    {selected.homed ? (
                      <span className="badge ok">连续可信段到达归巢点</span>
                    ) : reviewDisposition(selected) === "accepted" ? (
                      <span className="badge info">双高置信解冻采信，重入排行</span>
                    ) : selected.firstDisputeIndex >= 0 ? (
                      <span className="badge danger">
                        争议自段 {selected.firstDisputeIndex + 1} 起冻结
                      </span>
                    ) : (
                      <span className="badge warn">在飞，归巢点未报</span>
                    )}
                  </dd>
                  <dt>可信均速</dt>
                  <dd>{fmtSpeed(selected.avgSpeedMpm)}</dd>
                  <dt>可信航距</dt>
                  <dd>
                    {fmtKm(selected.trustedKm)} / {fmtKm(selected.totalKm)}
                  </dd>
                  <dt>最近复核</dt>
                  <dd>{shortIso(selected.review?.lastResultAt ?? selected.review?.firstRequestedAt)}</dd>
                </dl>
                <hr className="soft" />
                <Timeline analysis={selected} />
                {selected.firstDisputeIndex >= 0 &&
                  reviewDisposition(selected) !== "accepted" && (
                    <ReviewPanel
                      analysis={selected}
                      onSubmitVote={submitVote}
                      onReset={resetReview}
                    />
                  )}
                {reviewDisposition(selected) === "rejected" && (
                  <div className="review-box">
                    <strong className="inline">
                      <span className="badge warn">双低置信一致</span>
                      争议段维持不计，该赛程不计归巢
                    </strong>
                    <button onClick={resetReview}>撤回复核重开</button>
                  </div>
                )}
              </section>

              <PairingPanel
                ringNo={selectedRace.ringNo}
                profile={state.profiles.find(
                  (p) => p.ringNo === selectedRace.ringNo
                )}
                analysesByRing={analysesByRing}
                profileVersion={pfVersion}
              />

              <RaceEditor
                race={selectedRace}
                onSaveRace={saveRace}
                onDelete={() => {
                  deleteRace(selectedRace.id);
                  setSelectedId(analyses.find((a) => a.race.id !== selectedRace.id)?.race.id ?? null);
                }}
              />
            </>
          ) : (
            <section className="panel empty">
              从左侧选择一羽赛程查看时间轴、复核与配对提示
            </section>
          )}
        </div>
      </div>
    </main>
  );
}
