import type { BirdProfile, RaceAnalysis } from "../types";
import { effectiveHomed } from "../lib/analyze";

interface Props {
  ringNo: string;
  profile?: BirdProfile;
  /** 足环号 → 最新复测结论 */
  analysesByRing: Map<string, RaceAnalysis>;
  profileVersion: string;
}

/** 配对提示：随赛程复测结论与足环档案重算，争议未解冻不予推荐 */
export function PairingPanel({ ringNo, profile, analysesByRing, profileVersion }: Props) {
  const my = analysesByRing.get(ringNo);
  const mySafe = my ? effectiveHomed(my) : false;

  return (
    <div className="panel">
      <div className="section-title">
        <div>
          <h2>配对提示</h2>
          <p>档案版本 {profileVersion.slice(0, 10)} · 复测一变即重算</p>
        </div>
        <span className={`badge ${mySafe ? "ok" : "warn"}`}>
          {mySafe ? "本羽结论可配" : "本羽存在风险"}
        </span>
      </div>

      {!profile || profile.pairing.length === 0 ? (
        <div className="empty">该足环档案中暂无配对记录</div>
      ) : (
        <div className="stack">
          {profile.pairing.map((p) => {
            const other = analysesByRing.get(p.partnerRing);
            const otherSafe = other ? effectiveHomed(other) : null;
            const blocked = !mySafe || otherSafe === false;
            return (
              <div key={p.partnerRing} className="pair-item">
                <h4>
                  × {p.partnerRing}
                  {otherSafe === null ? (
                    <span className="badge muted">无赛程</span>
                  ) : otherSafe ? (
                    <span className="badge ok">对方复测可信</span>
                  ) : (
                    <span className="badge danger">对方争议未消</span>
                  )}
                </h4>
                <p>{p.note}</p>
                <div>
                  {blocked ? (
                    <span className="badge danger">暂不建议配对 · 航迹争议冻结中</span>
                  ) : (
                    <span className="badge ok">可进入配对计划</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
