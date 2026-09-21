import { useStore } from "../store/store";
import { useDerived } from "../store/useDerived";
import {
  CONFIDENCE_LABEL,
  formatDateTime,
  ISSUE_LABELS,
  toLocalDateTime,
} from "../domain/model";
import { ResolutionBadge, RiskBadge, StatusBadge } from "./widgets";

export function Overview({
  onGo,
}: {
  onGo: (tab: string, legId?: string) => void;
}) {
  const { state, snapshots } = useStore();
  const d = useDerived();

  const totalLegs = d.analyses.length;
  const ranked = d.ranking.filter((r) => r.ranked);
  const homeCount = ranked.length;
  const notHomeCount = d.notHome.filter((r) => r.kind !== "inflight").length;
  const inflight = d.notHome.filter((r) => r.kind === "inflight").length;
  const avgSpeed = ranked.length
    ? Math.round(ranked.reduce((s, r) => s + r.speedMpm, 0) / ranked.length)
    : 0;
  const returnRate = totalLegs
    ? Math.round((homeCount / totalLegs) * 100)
    : 0;
  const disputedCount = d.analyses.filter((a) => a.status === "disputed")
    .length;

  return (
    <div className="tab-grid">
      <section className="metric-grid">
        <Metric title="赛程总数" value={String(totalLegs)} sub={`档案版本 v${state.version}`} />
        <Metric
          title="可信归巢率"
          value={`${returnRate}%`}
          sub={`仅统计连续可信/解冻采信段`}
          tone="ok"
        />
        <Metric
          title="可信平均速度"
          value={avgSpeed ? `${avgSpeed}` : "—"}
          sub="米/分（排行赛程）"
        />
        <Metric
          title="争议冻结"
          value={String(disputedCount)}
          sub={`未归巢 ${notHomeCount} · 在飞 ${inflight}`}
          tone={disputedCount ? "bad" : "ok"}
        />
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="panel-kicker">连续可信段才进排行</p>
            <h2>训放成绩排行（前 5）</h2>
          </div>
          <button className="link-btn" onClick={() => onGo("ranking")}>
            查看完整排行 →
          </button>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>名次</th>
              <th>足环号</th>
              <th>血统</th>
              <th>放飞地</th>
              <th>可信均速</th>
              <th>到家时刻</th>
              <th>状态</th>
            </tr>
          </thead>
          <tbody>
            {d.ranking.slice(0, 5).map((row, i) => (
              <tr
                key={row.analysis.leg.id}
                className={row.ranked ? "" : "row-muted"}
                onClick={() => onGo("legs", row.analysis.leg.id)}
              >
                <td>{row.ranked ? i + 1 : "—"}</td>
                <td className="mono">{row.analysis.ring?.ringNo ?? "缺档"}</td>
                <td>{row.analysis.ring?.bloodline ?? "—"}</td>
                <td>{row.analysis.site?.name ?? "—"}</td>
                <td>{row.ranked ? `${row.speedMpm} m/min` : "—"}</td>
                <td>
                  {row.ranked && row.analysis.site
                    ? formatDateTime(
                        toLocalDateTime(
                          row.analysis.homeUtc,
                          row.analysis.site.offsetMin
                        )
                      )
                    : row.excludeReason}
                </td>
                <td>
                  <StatusBadge status={row.analysis.status} />
                </td>
              </tr>
            ))}
            {d.ranking.length === 0 && (
              <tr>
                <td colSpan={7} className="empty">
                  暂无赛程
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="panel panel-split">
        <div>
          <div className="panel-head">
            <div>
              <p className="panel-kicker">争议段不计未归巢，解冻后归类</p>
              <h2>未归巢提醒</h2>
            </div>
            <button className="link-btn" onClick={() => onGo("disputes")}>
              争议队列 →
            </button>
          </div>
          <ul className="notice-list">
            {d.notHome.slice(0, 6).map((r) => (
              <li
                key={r.analysis.leg.id}
                className={`notice notice-${r.kind}`}
                onClick={() => onGo("legs", r.analysis.leg.id)}
              >
                <div>
                  <b className="mono">{r.analysis.ring?.ringNo ?? "缺档"}</b>
                  <span>{r.analysis.site?.name ?? "—"}</span>
                </div>
                <div className="notice-right">
                  <RiskBadge risk={r.analysis.risk} />
                  <em>{r.label}</em>
                </div>
              </li>
            ))}
            {d.notHome.length === 0 && (
              <li className="empty">全部赛程均已可信归巢</li>
            )}
          </ul>
        </div>

        <div>
          <div className="panel-head">
            <div>
              <p className="panel-kicker">排行/风险重算后同步失效重算</p>
              <h2>配对提示</h2>
            </div>
          </div>
          <ul className="pair-list">
            {d.pairing.slice(0, 5).map((h) => (
              <li key={`${h.sire.id}-${h.dam.id}`}>
                <div className="pair-birds">
                  <b className="mono">{h.sire.ringNo}</b>
                  <span className="pair-x">×</span>
                  <b className="mono">{h.dam.ringNo}</b>
                </div>
                <div className="pair-meta">
                  <strong>{h.score}</strong>
                  <span>{h.reason}</span>
                </div>
              </li>
            ))}
            {d.pairing.length === 0 && (
              <li className="empty">需雌雄双方均有可信战绩后生成</li>
            )}
          </ul>
        </div>
      </section>

      <section className="panel panel-split">
        <div>
          <div className="panel-head">
            <div>
              <p className="panel-kicker">最新矛盾点</p>
              <h2>风险雷达</h2>
            </div>
          </div>
          <ul className="issue-flat">
            {d.analyses
              .filter((a) => a.issues.length > 0)
              .slice(0, 5)
              .map((a) => (
                <li key={a.leg.id} onClick={() => onGo("legs", a.leg.id)}>
                  <b className="mono">{a.ring?.ringNo ?? a.leg.ringId}</b>
                  <span>
                    {a.issues.map((c) => ISSUE_LABELS[c]).join("；")}
                  </span>
                  <RiskBadge risk={a.risk} />
                </li>
              ))}
            {d.analyses.every((a) => a.issues.length === 0) && (
              <li className="empty">当前无矛盾点</li>
            )}
          </ul>
        </div>
        <div>
          <div className="panel-head">
            <div>
              <p className="panel-kicker">参数一变，旧版只读</p>
              <h2>版本痕迹</h2>
            </div>
            <button className="link-btn" onClick={() => onGo("versions")}>
              旧版存档 →
            </button>
          </div>
          <ul className="snap-mini">
            <li>
              <b>当前 v{state.version}</b>
              <span>
                限速 {state.maxMpm} m/min · 容差 {state.toleranceKm}km
              </span>
            </li>
            {snapshots.slice(0, 3).map((s) => (
              <li key={s.version}>
                <b>v{s.version}（只读冻结）</b>
                <span title={s.reason}>{s.reason}</span>
              </li>
            ))}
            {snapshots.length === 0 && <li className="empty">尚无历史版本</li>}
          </ul>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="panel-kicker">两名复核人 · 同档一致才解冻</p>
            <h2>最近复核</h2>
          </div>
        </div>
        <ul className="review-flat">
          {[...state.reviews]
            .sort((a, b) => b.at - a.at)
            .slice(0, 4)
            .map((r) => {
              const a = d.analysisById.get(r.legId);
              const reviewer = state.reviewers.find(
                (x) => x.id === r.reviewerId
              );
              const stale = a ? r.issueSignature !== a.issueSignature : false;
              return (
                <li key={r.id}>
                  <div>
                    <b>
                      {reviewer?.name ?? r.reviewerId} ·{" "}
                      {CONFIDENCE_LABEL[r.confidence]}
                    </b>
                    <span className="review-reason">{r.reason}</span>
                  </div>
                  <div className="notice-right">
                    {stale ? (
                      <span className="badge badge-warn">问题已变·失效</span>
                    ) : (
                      <span className="badge badge-info">待比对</span>
                    )}
                    <em className="mono">{a?.ring?.ringNo ?? r.legId}</em>
                  </div>
                </li>
              );
            })}
          {state.reviews.length === 0 && (
            <li className="empty">尚无复核记录</li>
          )}
        </ul>
      </section>
    </div>
  );
}

function Metric({
  title,
  value,
  sub,
  tone,
}: {
  title: string;
  value: string;
  sub?: string;
  tone?: "ok" | "bad";
}) {
  return (
    <article className={`metric metric-${tone ?? ""}`}>
      <small>{title}</small>
      <strong>{value}</strong>
      {sub ? <em>{sub}</em> : null}
    </article>
  );
}
