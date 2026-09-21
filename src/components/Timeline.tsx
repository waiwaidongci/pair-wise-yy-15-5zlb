import type { RaceAnalysis, SegmentResult } from "../types";
import { ISSUE_TEXT } from "../lib/analyze";
import { epochToWall, wallToEpoch } from "../lib/time";
import { fmtKm, fmtMinutes, fmtSpeed } from "../lib/format";

interface Props {
  analysis: RaceAnalysis;
}

interface Row {
  key: string;
  name: string;
  wall: string;
  cumKm: number;
  kind: "release" | "ok" | "bad" | "frozen";
  seg: SegmentResult | null;
  offsetSec: number;
}

/** 赛程时间轴：放飞点 → 各鸽钟报点；连续可信段与争议段着色 */
export function Timeline({ analysis }: Props) {
  const { race, segments, firstDisputeIndex, review } = analysis;

  const rows: Row[] = [
    {
      key: "release",
      name: `${race.releaseName}（放飞地）`,
      wall: race.releaseTime.replace("T", " "),
      cumKm: 0,
      kind: "release",
      seg: null,
      offsetSec: 0,
    },
  ];

  race.reports.forEach((r, i) => {
    const disputed = firstDisputeIndex >= 0 && i >= firstDisputeIndex;
    const accepted = disputed && review?.status === "unfrozen";
    const off = r.clockOffsetSec ?? 0;
    const wall = epochToWall(
      wallToEpoch(r.clockTime, race.timeZone) + off * 1000,
      race.timeZone
    );
    rows.push({
      key: r.id,
      name: `${r.name}${r.home ? " 🏠" : ""}`,
      wall,
      cumKm: r.cumKm,
      kind: !disputed ? "ok" : accepted ? "frozen" : "bad",
      seg: segments[i] ?? null,
      offsetSec: off,
    });
  });

  return (
    <div className="timeline">
      {rows.map((row, idx) => {
        const seg = row.seg;
        const issueTags =
          seg && !seg.trusted ? seg.issues.map((k) => ISSUE_TEXT[k]) : [];
        return (
          <div key={row.key} className={`tl-row ${issueTags.length ? "bad" : ""}`}>
            <div className={`tl-dot ${row.kind}`} />
            <div className="tl-main">
              <h4>{row.name}</h4>
              <p>
                {row.wall} · 桩位 {fmtKm(row.cumKm)}
                {row.offsetSec !== 0 && (
                  <>
                    {" "}
                    · 校准{" "}
                    {row.offsetSec > 0 ? "+" : ""}
                    {row.offsetSec}s
                  </>
                )}
                {seg && (
                  <>
                    {" "}
                    · 本段 {fmtMinutes(seg.minutes)} /{" "}
                    {seg.speedMpm >= 0 ? fmtSpeed(seg.speedMpm) : "时刻异常"} ·
                    位移 {fmtKm(seg.geoKm)}
                  </>
                )}
                {idx === 0 && (
                  <>
                    {" "}
                    · 时区 {race.timeZone} · 限速 {race.speedLimitMpm}
                  </>
                )}
              </p>
              {issueTags.length > 0 && (
                <div className="tl-issue">
                  {issueTags.map((t) => (
                    <span key={t} className="badge danger">
                      ⚠ {t}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="tl-side">
              {seg ? (
                <>
                  <b>{fmtKm(seg.cumDeltaKm)}</b>
                  段{idx}
                </>
              ) : (
                <b>开笼</b>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
