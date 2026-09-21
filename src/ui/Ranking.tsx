import { useState } from "react";
import { useStore } from "../store/store";
import { useDerived } from "../store/useDerived";
import {
  formatDateTime,
  toLocalDateTime,
  type LegAnalysis,
} from "../domain/model";
import { StatusBadge } from "./widgets";

export function Ranking({ onOpenLeg }: { onOpenLeg: (id: string) => void }) {
  const { state } = useStore();
  const d = useDerived();
  const [showExcluded, setShowExcluded] = useState(true);
  const rows = showExcluded ? d.ranking : d.ranking.filter((r) => r.ranked);

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <p className="panel-kicker">
            仅连续可信段计入；争议段即使有末点也不排行，解冻采信后重入
          </p>
          <h2>训放成绩排行</h2>
        </div>
        <label className="switch">
          <input
            type="checkbox"
            checked={showExcluded}
            onChange={(e) => setShowExcluded(e.target.checked)}
          />
          同时显示排除项
        </label>
      </div>

      <table className="data-table ranking-table">
        <thead>
          <tr>
            <th>名次</th>
            <th>足环号 / 血统</th>
            <th>放飞地</th>
            <th>放飞→到家历时</th>
            <th>可信航距</th>
            <th>连续可信均速</th>
            <th>状态</th>
            <th>排除/入选说明</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const a: LegAnalysis = row.analysis;
            const mins = row.ranked
              ? Math.round((a.homeUtc - a.releaseUtc) / 60000)
              : null;
            return (
              <tr
                key={a.leg.id}
                className={row.ranked ? "row-clickable" : "row-muted"}
                onClick={() => onOpenLeg(a.leg.id)}
              >
                <td>
                  {row.ranked ? (
                    <span className={`rank-no rank-${i < 3 ? i + 1 : "x"}`}>
                      {i + 1}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td>
                  <b className="mono">{a.ring?.ringNo ?? "缺档"}</b>
                  <small className="dim"> {a.ring?.bloodline}</small>
                </td>
                <td>{a.site?.name ?? "—"}</td>
                <td>
                  {mins !== null ? (
                    <>
                      {formatDateTime(a.leg.releaseLocal)} →{" "}
                      {a.site &&
                        formatDateTime(
                          toLocalDateTime(a.homeUtc, a.site.offsetMin)
                        )}
                      <small className="dim">（{mins} 分钟）</small>
                    </>
                  ) : (
                    "—"
                  )}
                </td>
                <td>{row.ranked ? `${row.homeKm || a.totalKm} km` : "—"}</td>
                <td>
                  {row.ranked ? (
                    <strong>{row.speedMpm} m/min</strong>
                  ) : (
                    "—"
                  )}
                </td>
                <td>
                  <StatusBadge status={a.status} />
                </td>
                <td className="dim">{row.ranked ? "连续可信段到家" : row.excludeReason}</td>
              </tr>
            );
          })}
          {rows.length === 0 && (
            <tr>
              <td colSpan={8} className="empty">
                暂无可排行赛程
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <p className="form-note">
        当前判定参数：分段限速 {state.maxMpm} m/min，累计航距容差{" "}
        {state.toleranceKm}km。参数或档案变更后本排行立即失效重算，旧版可在「版本存档」只读回看。
      </p>
    </section>
  );
}
