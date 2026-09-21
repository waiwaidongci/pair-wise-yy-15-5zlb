import type {
  ClockCalibration,
  ClockPunch,
  Confidence,
  RaceLeg,
  ReleaseSite,
  Review,
  RingRecord,
} from "./types";

export type { Confidence };

/* ---------------- 时间换算（离线，仅用固定偏移） ---------------- */

/** 钟面本地时刻 + 放飞地时区偏移 + 鸽钟校准 → 标准 UTC 毫秒 */
export function toUtcMs(
  localDateTime: string,
  siteOffsetMin: number,
  clockDeltaSec = 0
): number {
  const t = localDateTime.trim().replace(" ", "T");
  const m = t.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return NaN;
  const [, y, mo, d, h, mi, s] = m;
  return (
    Date.UTC(+y, +mo - 1, +d, +h, +mi, s ? +s : 0) -
    siteOffsetMin * 60_000 -
    clockDeltaSec * 1000
  );
}

/** UTC 毫秒 → 指定时区本地时刻 */
export function toLocalDateTime(utcMs: number, siteOffsetMin: number): string {
  const dt = new Date(utcMs + siteOffsetMin * 60_000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(
      dt.getUTCDate()
    )}T${pad(dt.getUTCHours())}:${pad(dt.getUTCMinutes())}:${pad(
      dt.getUTCSeconds()
    )}`
  );
}

export function formatDateTime(s: string): string {
  const t = s.trim().replace(" ", "T");
  const m = t.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return s;
  const [, y, mo, d, h, mi, se] = m;
  return `${y}-${mo}-${d} ${h}:${mi}${se && se !== "00" ? ":" + se : ""}`;
}

/* ---------------- 分析输入/输出类型 ---------------- */

export interface AnalysisInput {
  leg: RaceLeg;
  ring?: RingRecord;
  site?: ReleaseSite;
  clock?: ClockCalibration;
  maxMpm: number;
  toleranceKm: number;
}

export type IssueCode =
  | "missing_ring"
  | "missing_site"
  | "missing_clock"
  | "bad_time"
  | "before_release"
  | "time_inversion"
  | "distance_inversion"
  | "overspeed"
  | "overshoot";

export interface PunchPoint {
  index: number; // 从 1 开始
  punch: ClockPunch;
  utcMs: number;
  cumKm: number;
  trusted: boolean;
  issues: IssueCode[];
  segment?: SegmentInfo;
}

export interface SegmentInfo {
  from: "release" | `punch-${number}`;
  distanceKm: number;
  elapsedMin: number;
  speedMpm: number;
}

export type LegStatus =
  | "ok" // 全部报时连续可信且到家
  | "disputed" // 存在矛盾段，争议未解
  | "inflight" // 无矛盾但尚未有到家报时
  | "missing"; // 引用档案缺失，无法复测

export type RiskLevel = "none" | "low" | "mid" | "high";

export interface LegAnalysis {
  leg: RaceLeg;
  ring?: RingRecord;
  site?: ReleaseSite;
  clock?: ClockCalibration;
  releaseUtc: number;
  points: PunchPoint[];
  trustedPrefixCount: number; // 从放飞起连续可信段数（0=首段即矛盾）
  trustedHomeIndex: number; // 连续可信序列中首个到家点（1 起），0=无
  status: LegStatus;
  issues: IssueCode[];
  risk: RiskLevel;
  homeUtc: number; // 连续可信到家时刻（毫秒）
  avgMpm: number | null; // 连续可信到家均速（米/分）
  totalKm: number;
  toleranceKm: number;
  issueSignature: string; // 矛盾点指纹：问题码 + 落点构成
}

/* ---------------- 单赛程分析 ---------------- */

export const ISSUE_LABELS: Record<IssueCode, string> = {
  missing_ring: "足环档案缺失",
  missing_site: "放飞地档案缺失",
  missing_clock: "鸽钟档案缺失",
  bad_time: "钟面时刻无法解析",
  before_release: "报时早于放飞时刻",
  time_inversion: "报时时刻未严格递增",
  distance_inversion: "累计航距未严格递增",
  overspeed: "分段速度超过限速",
  overshoot: "累计航距超出司放全程",
};

export function analyzeLeg(input: AnalysisInput): LegAnalysis {
  const { leg, ring, site, clock, maxMpm, toleranceKm } = input;
  const offset = site?.offsetMin ?? 0;
  const delta = clock?.deltaSec ?? 0;
  const totalKm = site?.totalKm ?? NaN;
  const releaseUtc = toUtcMs(leg.releaseLocal, offset, delta);
  const allIssues = new Set<IssueCode>();

  if (!ring) allIssues.add("missing_ring");
  if (!site) allIssues.add("missing_site");
  if (!clock) allIssues.add("missing_clock");

  let status: LegStatus = "inflight";
  if (allIssues.size > 0) status = "missing";

  // 按录入顺序逐点判定；连续可信段在第一个矛盾点中断
  let prevUtc = releaseUtc;
  let prevKm = 0;
  let broken = status === "missing";
  let trustedCount = 0;
  let trustedHome = 0;

  const points: PunchPoint[] = leg.punches.map((punch, i) => {
    const issues: IssueCode[] = [];
    const utc = toUtcMs(punch.clockLocal, offset, delta);
    const cumKm = +punch.cumKm;

    if (Number.isNaN(utc)) issues.push("bad_time");
    if (!Number.isNaN(utc) && !Number.isNaN(releaseUtc) && utc < releaseUtc)
      issues.push("before_release");
    if (!Number.isNaN(utc) && utc <= prevUtc) issues.push("time_inversion");
    if (!(cumKm > prevKm)) issues.push("distance_inversion");

    let segment: SegmentInfo | undefined;
    if (
      !Number.isNaN(utc) &&
      !Number.isNaN(releaseUtc) &&
      utc > prevUtc &&
      cumKm > prevKm
    ) {
      const distanceKm = +(cumKm - prevKm).toFixed(3);
      const elapsedMin = (utc - prevUtc) / 60000;
      const speedMpm = +((distanceKm * 1000) / elapsedMin).toFixed(1);
      segment = {
        from: i === 0 ? "release" : `punch-${i}`,
        distanceKm,
        elapsedMin: +elapsedMin.toFixed(2),
        speedMpm,
      };
      if (speedMpm > maxMpm) issues.push("overspeed");
    }

    if (!Number.isNaN(totalKm) && cumKm > totalKm + toleranceKm)
      issues.push("overshoot");

    const trusted = !broken && issues.length === 0;
    if (trusted) {
      trustedCount += 1;
      if (trustedHome === 0 && cumKm >= totalKm - toleranceKm)
        trustedHome = i + 1;
      prevUtc = utc;
      prevKm = cumKm;
    } else {
      broken = true;
    }

    issues.forEach((c) => allIssues.add(c));
    return { index: i + 1, punch, utcMs: utc, cumKm, trusted, issues, segment };
  });

  if (status !== "missing") {
    status = allIssues.size > 0 ? "disputed" : trustedHome > 0 ? "ok" : "inflight";
  }

  // 连续可信到家时刻与均速
  let homeUtc = 0;
  let avgMpm: number | null = null;
  if (trustedHome > 0) {
    const p = points[trustedHome - 1];
    homeUtc = p.utcMs;
    const mins = (homeUtc - releaseUtc) / 60000;
    avgMpm = mins > 0 ? +((p.cumKm * 1000) / mins).toFixed(1) : null;
  }

  const risk: RiskLevel =
    status === "missing"
      ? "high"
      : allIssues.has("overspeed") ||
        allIssues.has("time_inversion") ||
        allIssues.has("before_release")
      ? "high"
      : allIssues.has("overshoot")
      ? "mid"
      : allIssues.size > 0
      ? "mid"
      : status === "inflight"
      ? "low"
      : "none";

  const signatureParts = points
    .filter((p) => p.issues.length > 0)
    .map((p) => `${p.index}:${[...new Set(p.issues)].sort().join("|")}@${p.cumKm}`);
  if (!ring) signatureParts.unshift("missing_ring");
  if (!site) signatureParts.unshift("missing_site");
  if (!clock) signatureParts.unshift("missing_clock");

  return {
    leg,
    ring,
    site,
    clock,
    releaseUtc,
    points,
    trustedPrefixCount: trustedCount,
    trustedHomeIndex: trustedHome,
    status,
    issues: [...allIssues],
    risk,
    homeUtc,
    avgMpm,
    totalKm,
    toleranceKm,
    issueSignature: signatureParts.join("#") || "clean",
  };
}

/* ---------------- 双重复核解冻 ---------------- */

export type ResolutionKind = "accept" | "reject" | "retest";

export interface Resolution {
  kind: ResolutionKind | null;
  frozen: boolean; // 两名复核人意见一致（同档）才解冻
  matchedConfidence?: Confidence;
  reviews: Review[]; // 仅统计针对当前矛盾指纹、且未被沿用规则丢弃的首条
  stale: Review[]; // 数据已变化、针对旧问题指纹的复核
  note: string;
}

export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  high: "高置信·建议采信",
  mid: "中置信·存疑补测",
  low: "低置信·建议驳回",
};

export function resolveReviews(
  legId: string,
  reviews: Review[],
  signature: string,
  reviewerIds: string[]
): Resolution {
  const stale = reviews.filter(
    (r) => r.legId === legId && r.issueSignature !== signature
  );
  // 同一复核人对同一问题指纹重复提请 → 沿用首条
  const firstByReviewer = new Map<string, Review>();
  for (const r of reviews) {
    if (r.legId !== legId || r.issueSignature !== signature) continue;
    if (!firstByReviewer.has(r.reviewerId)) firstByReviewer.set(r.reviewerId, r);
  }
  const active = reviewerIds
    .map((id) => firstByReviewer.get(id))
    .filter((r): r is Review => !!r);

  if (active.length === 0)
    return { kind: null, frozen: true, reviews: [], stale, note: "尚无复核" };

  if (active.length < 2)
    return {
      kind: null,
      frozen: true,
      reviews: active,
      stale,
      note: `仅 ${active.length}/2 名复核人提交，争议保持冻结`,
    };

  const confs = active.map((r) => r.confidence);
  if (confs[0] !== confs[1]) {
    return {
      kind: null,
      frozen: true,
      reviews: active,
      stale,
      note: "两名复核人置信档不一致，保持冻结",
    };
  }

  const c = confs[0];
  const kind: ResolutionKind = c === "high" ? "accept" : c === "low" ? "reject" : "retest";
  return {
    kind,
    frozen: false,
    matchedConfidence: c,
    reviews: active,
    stale,
    note:
      kind === "accept"
        ? "双高一致，争议段解冻并采信，进入排行"
        : kind === "reject"
        ? "双低一致，争议段驳回，按未归巢计"
        : "双中一致，解冻为补测：暂不排行、暂不记未归巢",
  };
}

/* ---------------- 排行 / 未归巢 / 配对 ---------------- */

export interface RankRow {
  analysis: LegAnalysis;
  resolution: Resolution;
  ranked: boolean;
  speedMpm: number;
  homeUtc: number;
  homeKm: number;
  accepted: boolean; // 经双高复核采信解冻
  excludeReason?: string;
}

export function isRanked(a: LegAnalysis, r: Resolution): boolean {
  if (a.status === "missing") return false;
  if (a.status === "ok") return true;
  if (a.status === "disputed" && !r.frozen && r.kind === "accept") return true;
  return false;
}

export function rankReason(a: LegAnalysis, r: Resolution): string | undefined {
  if (a.status === "missing") return "引用档案缺失，无法复测";
  if (a.status === "inflight") return "尚未有到家报时";
  if (a.status === "disputed") {
    if (r.frozen) return "争议冻结中，不计排行";
    if (r.kind === "reject") return "复核驳回，按未归巢计";
    if (r.kind === "retest") return "复核补测，暂不排行";
  }
  return undefined;
}

export function buildRanking(
  analyses: LegAnalysis[],
  reviews: Review[],
  reviewerIds: string[]
): RankRow[] {
  return analyses
    .map((analysis) => {
      const resolution = resolveReviews(
        analysis.leg.id,
        reviews,
        analysis.issueSignature,
        reviewerIds
      );
      const ranked = isRanked(analysis, resolution);
      const accepted =
        analysis.status === "disputed" &&
        !resolution.frozen &&
        resolution.kind === "accept";
      // 双高采信解冻：以首个达到全程的报时点计可信到家均速
      // （其之前须为连续可信段；争议段本身经复核采信）
      let speedMpm = analysis.avgMpm ?? 0;
      let homeUtc = analysis.homeUtc;
      let homeKm =
        analysis.trustedHomeIndex > 0
          ? analysis.points[analysis.trustedHomeIndex - 1]?.cumKm ?? 0
          : 0;
      if (accepted) {
        const reach = analysis.points.find(
          (p) =>
            !Number.isNaN(p.utcMs) &&
            analysis.totalKm > 0 &&
            p.cumKm >= analysis.totalKm - analysis.toleranceKm &&
            p.cumKm <= analysis.totalKm + analysis.toleranceKm
        );
        if (reach && !Number.isNaN(analysis.releaseUtc)) {
          const mins = (reach.utcMs - analysis.releaseUtc) / 60000;
          if (mins > 0) speedMpm = +((reach.cumKm * 1000) / mins).toFixed(1);
          homeUtc = reach.utcMs;
          homeKm = reach.cumKm;
        }
      }
      return {
        analysis,
        resolution,
        ranked,
        speedMpm,
        homeUtc,
        homeKm,
        accepted,
        excludeReason: rankReason(analysis, resolution),
      };
    })
    .sort((a, b) => {
      if (a.ranked !== b.ranked) return a.ranked ? -1 : 1;
      if (a.ranked) return b.speedMpm - a.speedMpm;
      return a.homeUtc - b.homeUtc;
    });
}

export type NotHomeKind = "disputed" | "rejected" | "inflight" | "missing" | "retest";

export interface NotHomeRow {
  analysis: LegAnalysis;
  resolution: Resolution;
  kind: NotHomeKind;
  label: string;
}

export function buildNotHome(
  analyses: LegAnalysis[],
  reviews: Review[],
  reviewerIds: string[]
): NotHomeRow[] {
  const rows: NotHomeRow[] = [];
  for (const a of analyses) {
    const r = resolveReviews(a.leg.id, reviews, a.issueSignature, reviewerIds);
    if (a.status === "ok") continue;
    if (a.status === "disputed" && !r.frozen && r.kind === "accept") continue;
    let kind: NotHomeKind;
    let label: string;
    if (a.status === "missing") {
      kind = "missing";
      label = "档案缺失";
    } else if (a.status === "inflight") {
      kind = "inflight";
      label = "在飞未归";
    } else if (r.frozen) {
      kind = "disputed";
      label = "争议冻结";
    } else if (r.kind === "reject") {
      kind = "rejected";
      label = "复核驳回·未归巢";
    } else {
      kind = "retest";
      label = "补测中";
    }
    rows.push({ analysis: a, resolution: r, kind, label });
  }
  const weight: Record<NotHomeKind, number> = {
    rejected: 0,
    disputed: 1,
    missing: 2,
    retest: 3,
    inflight: 4,
  };
  return rows.sort((x, y) => weight[x.kind] - weight[y.kind]);
}

export interface PairingHint {
  sire: RingRecord;
  dam: RingRecord;
  score: number;
  rankedLegs: number;
  avgMpm: number;
  riskPenalty: number;
  reason: string;
}

/**
 * 配对提示：只从连续可信（含解冻采信）赛程中取成绩；
 * 排行、风险或档案一旦重算，提示同步失效重算。
 */
export function buildPairingHints(
  rings: RingRecord[],
  ranking: RankRow[]
): PairingHint[] {
  const stats = new Map<
    string,
    { count: number; speedSum: number; risk: number }
  >();
  for (const row of ranking) {
    if (!row.ranked) continue;
    const id = row.analysis.leg.ringId;
    const s = stats.get(id) ?? { count: 0, speedSum: 0, risk: 0 };
    s.count += 1;
    s.speedSum += row.speedMpm;
    stats.set(id, s);
  }
  // 风险扣分（争议/缺失越多越不宜作种）
  for (const a of ranking.map((r) => r.analysis)) {
    const s = stats.get(a.leg.ringId) ?? { count: 0, speedSum: 0, risk: 0 };
    s.risk +=
      a.risk === "high" ? 3 : a.risk === "mid" ? 1.5 : a.risk === "low" ? 0.5 : 0;
    stats.set(a.leg.ringId, s);
  }

  const scoreOf = (id: string) => {
    const s = stats.get(id);
    if (!s || s.count === 0) return null;
    const avg = s.speedSum / s.count;
    return {
      score: +(avg / 20 - s.risk * 4 + s.count * 3).toFixed(1),
      count: s.count,
      avg: +avg.toFixed(1),
      risk: s.risk,
    };
  };

  const hints: PairingHint[] = [];
  const sires = rings.filter((r) => r.sex === "雄");
  const dams = rings.filter((r) => r.sex === "雌");
  for (const sire of sires) {
    for (const dam of dams) {
      const a = scoreOf(sire.id);
      const b = scoreOf(dam.id);
      if (!a || !b) continue;
      const score = +(0.55 * a.score + 0.45 * b.score).toFixed(1);
      hints.push({
        sire,
        dam,
        score,
        rankedLegs: a.count + b.count,
        avgMpm: +((a.avg + b.avg) / 2).toFixed(1),
        riskPenalty: +(a.risk + b.risk).toFixed(1),
        reason: `雄 ${a.count} 战 / 雌 ${b.count} 战，可信均速 ${(
          (a.avg + b.avg) /
          2
        ).toFixed(0)} m/min，风险扣减 ${(a.risk + b.risk).toFixed(1)}`,
      });
    }
  }
  return hints.sort((x, y) => y.score - x.score);
}

/* ---------------- 时间轴 ---------------- */

export interface TimelineEvent {
  id: string;
  atMs: number;
  legId: string;
  ringLabel: string;
  siteName: string;
  kind: "release" | "punch" | "issue" | "review";
  title: string;
  detail: string;
  tone: "muted" | "ok" | "warn" | "bad" | "info";
}

export function buildTimeline(
  analyses: LegAnalysis[],
  reviews: Review[]
): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  for (const a of analyses) {
    const ringLabel = a.ring?.ringNo ?? a.leg.ringId;
    const siteName = a.site?.name ?? a.leg.siteId;
    if (!Number.isNaN(a.releaseUtc)) {
      events.push({
        id: `${a.leg.id}-release`,
        atMs: a.releaseUtc,
        legId: a.leg.id,
        ringLabel,
        siteName,
        kind: "release",
        title: "放飞",
        detail: `${ringLabel} @ ${siteName}`,
        tone: "info",
      });
    }
    for (const p of a.points) {
      if (Number.isNaN(p.utcMs)) continue;
      const home =
        a.trustedHomeIndex === p.index && p.trusted ? " · 到家" : "";
      events.push({
        id: `${a.leg.id}-punch-${p.punch.id}`,
        atMs: p.utcMs,
        legId: a.leg.id,
        ringLabel,
        siteName,
        kind: p.issues.length ? "issue" : "punch",
        title: p.issues.length
          ? `报时 ${p.index} · 矛盾中断`
          : `报时 ${p.index}${home}`,
        detail: p.issues.length
          ? p.issues.map((c) => ISSUE_LABELS[c]).join("；")
          : `累计 ${p.cumKm}km${
              p.segment ? `，分段 ${p.segment.speedMpm} m/min` : ""
            }`,
        tone: p.issues.length ? "bad" : p.trusted ? "ok" : "warn",
      });
    }
  }
  for (const r of reviews) {
    events.push({
      id: r.id,
      atMs: r.at,
      legId: r.legId,
      ringLabel: "",
      siteName: "",
      kind: "review",
      title: `复核 · ${CONFIDENCE_LABEL[r.confidence]}`,
      detail: r.reason,
      tone: r.confidence === "high" ? "ok" : r.confidence === "low" ? "bad" : "warn",
    });
  }
  return events.sort((x, y) => x.atMs - y.atMs);
}
