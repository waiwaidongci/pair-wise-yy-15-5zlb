import { useState } from "react";
import { useStore } from "../store/store";
import { useDerived } from "../store/useDerived";
import {
  formatDateTime,
  ISSUE_LABELS,
  toLocalDateTime,
} from "../domain/model";
import type { PersistState, VersionSnapshot } from "../domain/types";
import { Modal, ResolutionBadge, RiskBadge, StatusBadge } from "./widgets";

export function Versions() {
  const { state, snapshots, resetAll } = useStore();
  const [open, setOpen] = useState<VersionSnapshot | null>(null);

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <p className="panel-kicker">
            判定参数每次发布前，上一版完整档案自动冻结，只读、不可改写
          </p>
          <h2>版本存档（{snapshots.length}）</h2>
        </div>
        <button
          className="danger-ghost"
          onClick={() => {
            if (
              window.confirm(
                "确认恢复出厂演示数据？将清空本机全部赛程、复核与旧版存档。"
              )
            )
              resetAll();
          }}
        >
          恢复演示数据
        </button>
      </div>

      <ul className="version-list">
        <li className="version-current">
          <div>
            <b>当前 v{state.version}</b>
            <span>可编辑 · 排行/风险/配对基于本版实时派生</span>
          </div>
          <em>现行版本</em>
        </li>
        {snapshots.map((s) => (
          <li key={s.version} onClick={() => setOpen(s)}>
            <div>
              <b>
                v{s.version} · 只读冻结
              </b>
              <span title={s.reason}>{s.reason}</span>
            </div>
            <em>{new Date(s.frozenAt).toLocaleString()} 冻结 · 点击回看</em>
          </li>
        ))}
        {snapshots.length === 0 && (
          <li className="empty">尚无旧版；发布参数变更后在此生成只读快照。</li>
        )}
      </ul>

      <Modal
        open={!!open}
        onClose={() => setOpen(null)}
        title={open ? `旧版 v${open.version}（只读）` : ""}
        wide
      >
        {open && <SnapshotView snapshot={open} />}
      </Modal>
    </section>
  );
}

function SnapshotView({ snapshot }: { snapshot: VersionSnapshot }) {
  const s: PersistState = snapshot.data;
  const d = useDerived(s);

  return (
    <div className="snapshot-view read-only">
      <div className="ro-banner">
        只读旧版 · 冻结于 {new Date(snapshot.frozenAt).toLocaleString()} ·
        冻结原因：{snapshot.reason}
      </div>

      <h4>该版排行（{d.ranking.filter((r) => r.ranked).length} 羽在榜）</h4>
      <table className="data-table">
        <thead>
          <tr>
            <th>名次</th>
            <th>足环号</th>
            <th>放飞地</th>
            <th>均速 m/min</th>
            <th>到家时刻</th>
            <th>状态</th>
          </tr>
        </thead>
        <tbody>
          {d.ranking.map((row, i) => (
            <tr key={row.analysis.leg.id} className={row.ranked ? "" : "row-muted"}>
              <td>{row.ranked ? i + 1 : "—"}</td>
              <td className="mono">{row.analysis.ring?.ringNo ?? "缺档"}</td>
              <td>{row.analysis.site?.name ?? "—"}</td>
              <td>{row.ranked ? row.speedMpm : "—"}</td>
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
        </tbody>
      </table>

      <h4>该版争议队列（{d.analyses.filter((a) => a.status === "disputed").length}）</h4>
      <div className="dispute-cards">
        {d.analyses
          .filter((a) => a.status === "disputed")
          .map((a) => {
            const r = d.ranking.find((x) => x.analysis.leg.id === a.leg.id)
              ?.resolution;
            return (
              <article key={a.leg.id} className="dispute-card">
                <div className="dispute-top">
                  <b className="mono">{a.ring?.ringNo ?? "缺档"}</b>
                  <div className="badge-stack">
                    <RiskBadge risk={a.risk} />
                    {r && <ResolutionBadge resolution={r} />}
                  </div>
                </div>
                <p className="dispute-issues">
                  {a.issues.map((c) => ISSUE_LABELS[c]).join("；")}
                </p>
              </article>
            );
          })}
        {d.analyses.every((a) => a.status !== "disputed") && (
          <p className="empty">该版无争议</p>
        )}
      </div>

      <h4>该版参数</h4>
      <ul className="snap-params">
        <li>限速：{s.maxMpm} m/min</li>
        <li>容差：{s.toleranceKm} km</li>
        <li>
          放飞地：
          {s.sites
            .map((x) => `${x.name}(UTC${x.offsetMin / 60},${x.totalKm}km)`)
            .join("；")}
        </li>
        <li>
          鸽钟：
          {s.clocks.map((x) => `${x.name}(${x.deltaSec}s)`).join("；")}
        </li>
        <li>
          足环：
          {s.rings.map((x) => `${x.ringNo}/${x.bloodline}`).join("；")}
        </li>
      </ul>
    </div>
  );
}
