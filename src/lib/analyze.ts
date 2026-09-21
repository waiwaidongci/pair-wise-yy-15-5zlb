import type {
  ClockReport,
  Issue,
  IssueKind,
  Race,
  RaceAnalysis,
  Review,
  SegmentResult,
} from "../types";
import { haversineKm } from "./geo";
import { minutesBetween, wallToEpoch } from "./time";

export const ISSUE_TEXT: Record<IssueKind, string> = {
  NON_INCREASING_TIME: "报时时刻未严格递增",
  SPEED_OVER_LIMIT: "分段速度超过限速",
  CUM_REGRESSION: "累计航距回退",
  CUM_GEO_MISMATCH: "航距增量与地理位移明显不符",
};

/** 地理位移与桩位里程增量允许的偏差比例（绕飞系数）与绝对下限 */
const DETOUR_RATIO = 1.35;
const DETOUR_KM = 3;

/**
 * 参数签名：放飞地时区 / 坐标 / 时刻 / 限速 / 各点校准 / 全部报点原始值。
 * 任一变化 → 排行、风险、配对提示与复核意见全部失效重算。
 */
export function raceSignature(race: Race): string {
  const payload = [
    race.ringNo,
    race.releaseName,
    [race.releaseLat, race.releaseLng].join(","),
    race.timeZone,
    race.releaseTime,
    race.speedLimitMpm,
    ...race.reports.map((r) =>
      [r.id, r.clockTime, r.lat, r.lng, r.cumKm, r.clockOffsetSec ?? 0].join("|")
    ),
  ].join("#");
  let hash = 5381;
  for (let i = 0; i < payload.length; i++) {
    hash = ((hash << 5) + hash + payload.charCodeAt(i)) | 0;
  }
  return `sig-${(hash >>> 0).toString(36)}-${payload.length}`;
}

/** 鸟档签名：足环档案变化（血统/配对）→ 配对提示失效 */
export function profileSignature(
  profiles: { ringNo: string; bloodline: string; pairing: unknown[]; note?: string }[]
): string {
  const payload = JSON.stringify(
    [...profiles].sort((a, b) => a.ringNo.localeCompare(b.ringNo))
  );
  let hash = 5381;
  for (let i = 0; i < payload.length; i++) {
    hash = ((hash << 5) + hash + payload.charCodeAt(i)) | 0;
  }
  return `pf-${(hash >>> 0).toString(36)}`;
}

function analyzeSegments(race: Race) {
  const tz = race.timeZone;
  const pts: {
    report: ClockReport;
    epoch: number;
    lat: number;
    lng: number;
    cumKm: number;
  }[] = [];

  // 放飞点作为第 0 个计时点（官方时刻，不随鸽钟校准漂移）
  pts.push({
    report: {
      id: "release",
      name: "放飞地",
      lat: race.releaseLat,
      lng: race.releaseLng,
      clockTime: race.releaseTime,
      cumKm: 0,
    },
    epoch: wallToEpoch(race.releaseTime, tz),
    lat: race.releaseLat,
    lng: race.releaseLng,
    cumKm: 0,
  });

  for (const r of race.reports) {
    pts.push({
      report: r,
      // 鸽钟校准量只作用于该点鸽钟报时，放飞点官方时刻不漂移
      epoch: wallToEpoch(r.clockTime, tz) + (r.clockOffsetSec ?? 0) * 1000,
      lat: r.lat,
      lng: r.lng,
      cumKm: r.cumKm,
    });
  }

  const segments: SegmentResult[] = [];
  const issues: Issue[] = [];

  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const minutes = minutesBetween(a.epoch, b.epoch);
    const geoKm = haversineKm(a.lat, a.lng, b.lat, b.lng);
    const cumDeltaKm = b.cumKm - a.cumKm;
    const speedMpm = minutes > 0 ? (cumDeltaKm * 1000) / minutes : Infinity;
    const segIssues: IssueKind[] = [];

    if (!(minutes > 0)) segIssues.push("NON_INCREASING_TIME");
    if (minutes > 0 && speedMpm > race.speedLimitMpm)
      segIssues.push("SPEED_OVER_LIMIT");
    if (cumDeltaKm < 0) segIssues.push("CUM_REGRESSION");
    if (
      cumDeltaKm > 0 &&
      cumDeltaKm > geoKm * DETOUR_RATIO + DETOUR_KM
    ) {
      segIssues.push("CUM_GEO_MISMATCH");
    }

    for (const kind of segIssues) {
      const detail =
        kind === "NON_INCREASING_TIME"
          ? `「${a.report.name} → ${b.report.name}」间隔 ${minutes.toFixed(1)} 分钟，报时未严格递增`
          : kind === "SPEED_OVER_LIMIT"
            ? `段速 ${speedMpm.toFixed(0)} m/min ＞ 限速 ${race.speedLimitMpm} m/min`
            : kind === "CUM_REGRESSION"
              ? `累计航距 ${a.cumKm}km → ${b.cumKm}km，出现回退`
              : `航距增量 ${cumDeltaKm.toFixed(1)}km 远大于地理位移 ${geoKm.toFixed(1)}km`;
      issues.push({
        segmentIndex: i - 1,
        fromId: a.report.id,
        toId: b.report.id,
        kind,
        detail,
      });
    }

    segments.push({
      fromId: a.report.id,
      toId: b.report.id,
      fromName: a.report.name,
      toName: b.report.name,
      minutes,
      geoKm,
      cumDeltaKm,
      speedMpm: Number.isFinite(speedMpm) ? speedMpm : -1,
      issues: segIssues,
      trusted: segIssues.length === 0,
    });
  }

  return { segments, issues };
}

export function analyzeRace(
  race: Race,
  review: Review | null
): RaceAnalysis {
  const { segments, issues } = analyzeSegments(race);

  // 连续可信段：从放飞点起，遇到第一个矛盾段即截断，其后全部为争议段
  let trustedRunLength = 0;
  for (const seg of segments) {
    if (!seg.trusted) break;
    trustedRunLength++;
  }
  const firstDisputeIndex =
    trustedRunLength === segments.length ? -1 : trustedRunLength;

  const trustedSegs = segments.slice(0, trustedRunLength);
  const trustedKm = trustedSegs.reduce((s, x) => s + Math.max(0, x.cumDeltaKm), 0);
  const trustedMinutes = trustedSegs.reduce((s, x) => s + Math.max(0, x.minutes), 0);
  const totalKm = race.reports.length
    ? Math.max(...race.reports.map((r) => r.cumKm))
    : 0;
  const homeIndex = race.reports.findIndex((r) => r.home);
  const homed = homeIndex >= 0 && trustedRunLength >= homeIndex + 1;

  const trustedEnd =
    trustedRunLength > 0 ? race.reports[trustedRunLength - 1] : null;

  return {
    race,
    segments,
    trustedRunLength,
    firstDisputeIndex,
    issues,
    homed,
    trustedEndReportId: trustedEnd?.id ?? null,
    trustedKm,
    totalKm,
    avgSpeedMpm: trustedMinutes > 0 ? (trustedKm * 1000) / trustedMinutes : null,
    trustedMinutes,
    signature: raceSignature(race),
    review: review && review.issueSignature === raceSignature(race)
      ? review
      : null,
  };
}

export type Disposition = "none" | "accepted" | "rejected";

/** 双复核一致后争议段的处置：高置信一致=解冻采信；低置信一致=维持不计 */
export function reviewDisposition(a: RaceAnalysis): Disposition {
  const rv = a.review;
  if (!rv || rv.status !== "unfrozen") return "none";
  const bothHigh =
    rv.reviewerA?.level === "high" && rv.reviewerB?.level === "high";
  const bothLow = rv.reviewerA?.level === "low" && rv.reviewerB?.level === "low";
  if (bothHigh) return "accepted";
  if (bothLow) return "rejected";
  return "none";
}

/** 有效归巢：原可信全程，或双高置信解冻采信 */
export function effectiveHomed(a: RaceAnalysis): boolean {
  return a.homed || reviewDisposition(a) === "accepted";
}

/** 排行用有效均速：采信解冻后按全程重算 */
export function effectiveAvgSpeed(a: RaceAnalysis): number | null {
  if (a.homed) return a.avgSpeedMpm;
  if (reviewDisposition(a) !== "accepted") return null;
  const min = a.segments.reduce((s, x) => s + x.minutes, 0);
  const km = a.segments.reduce((s, x) => s + Math.max(0, x.cumDeltaKm), 0);
  return min > 0 ? (km * 1000) / min : null;
}
