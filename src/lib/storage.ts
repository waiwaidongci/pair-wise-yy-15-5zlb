const KEY = "pigeon-retest-v2";
const LEGACY_KEYS = ["pigeon-retest-v1"];

export interface PersistState {
  races: import("../types").Race[];
  profiles: import("../types").BirdProfile[];
  /** raceId -> 复核记录（仅匹配当前签名时有效，不匹配自动转旧版） */
  reviews: Record<string, import("../types").Review>;
  /** 旧版只读归档：参数变更后失效的复核结论 */
  archivedReviews: ArchivedReview[];
  /** 手动封存的只读版本 */
  snapshots: ReadOnlySnapshot[];
}

export interface ArchivedReview {
  id: string;
  raceId: string;
  ringNo: string;
  review: import("../types").Review;
  archivedAt: string;
  reason: string;
}

export interface ReadOnlySnapshot {
  id: string;
  label: string;
  createdAt: string;
  races: import("../types").Race[];
  reviews: Record<string, import("../types").Review>;
}

export function loadState(): PersistState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistState;
    if (!Array.isArray(parsed.races)) return null;
    parsed.archivedReviews ??= [];
    parsed.snapshots ??= [];
    parsed.reviews ??= {};
    parsed.profiles ??= [];
    // 历史版本里逐点校准字段补默认 0
    for (const r of parsed.races)
      for (const rep of r.reports) rep.clockOffsetSec ??= 0;
    return parsed;
  } catch {
    return null;
  }
}

export function saveState(state: PersistState) {
  localStorage.setItem(KEY, JSON.stringify(state));
}

export function clearState() {
  localStorage.removeItem(KEY);
  for (const k of LEGACY_KEYS) localStorage.removeItem(k);
}
