import { useState } from "react";
import type { ArchivedReview, ReadOnlySnapshot } from "../lib/storage";
import { shortIso } from "../lib/format";
import { epochToWall, wallToEpoch } from "../lib/time";

interface Props {
  archived: ArchivedReview[];
  snapshots: ReadOnlySnapshot[];
  onCreateSnapshot: (label: string) => void;
  onRemoveSnapshot: (id: string) => void;
  onClearArchived: () => void;
}

/** 旧版只读：失效的复核结论与手动封存版本只能查看，不能回改 */
export function ArchivePanel({
  archived,
  snapshots,
  onCreateSnapshot,
  onRemoveSnapshot,
  onClearArchived,
}: Props) {
  const [label, setLabel] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div className="panel">
      <div className="section-title">
        <div>
          <h2>旧版只读</h2>
          <p>参数变更后失效的复核结论与封存版本不可回改，仅留痕可查</p>
        </div>
      </div>

      <div className="inline" style={{ marginBottom: 16 }}>
        <input
          type="text"
          placeholder="封存版本标签，如 2026-09-20 早训冻结版"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
        <button
          className="primary"
          disabled={!label.trim()}
          onClick={() => {
            onCreateSnapshot(label.trim());
            setLabel("");
          }}
        >
          封存当前为只读版
        </button>
      </div>

      <h3 style={{ margin: "8px 0" }}>封存版本（{snapshots.length}）</h3>
      <div className="stack" style={{ marginBottom: 18 }}>
        {snapshots.length === 0 && <div className="empty">尚未封存任何版本</div>}
        {snapshots.map((s) => (
          <div key={s.id} className="snapshot-item">
            <h4>
              <span>📦 {s.label}</span>
              <span className="badge muted">{s.races.length} 羽赛程</span>
            </h4>
            <p>封存于 {shortIso(s.createdAt)}</p>
            <div className="inline">
              <button onClick={() => setOpen(open === s.id ? null : s.id)}>
                {open === s.id ? "收起内容" : "查看内容"}
              </button>
              <button className="danger ghost" onClick={() => onRemoveSnapshot(s.id)}>
                删除留痕
              </button>
            </div>
            {open === s.id && (
              <div className="stack" style={{ marginTop: 6 }}>
                {s.races.map((r) => {
                  const last = r.reports[r.reports.length - 1];
                  return (
                    <div key={r.id} className="snapshot-item" style={{ padding: 10 }}>
                      <h4>
                        <span>{r.ringNo}</span>
                        <span className="badge muted">{r.timeZone}</span>
                      </h4>
                      <p>
                        {r.releaseName} · 放飞{" "}
                        {epochToWall(wallToEpoch(r.releaseTime, r.timeZone), r.timeZone)}
                        {last &&
                          ` · 末次报时 ${epochToWall(
                            wallToEpoch(last.clockTime, r.timeZone) +
                              (last.clockOffsetSec ?? 0) * 1000,
                            r.timeZone
                          )}`}
                        {` · ${r.reports.length} 个报点 · 限速 ${r.speedLimitMpm}`}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="section-title">
        <h3 style={{ margin: 0 }}>失效复核留痕（{archived.length}）</h3>
        {archived.length > 0 && (
          <button className="ghost danger" onClick={onClearArchived}>
            清空留痕
          </button>
        )}
      </div>
      <div className="stack">
        {archived.length === 0 && (
          <div className="empty">暂无因参数变更而失效的复核结论</div>
        )}
        {archived.map((a) => {
          const lv = a.review.reviewerA?.level;
          return (
            <div key={a.id} className="snapshot-item">
              <h4>
                <span>{a.ringNo}</span>
                <span
                  className={`badge ${a.review.status === "unfrozen" ? "ok" : "warn"}`}
                >
                  {a.review.status === "unfrozen"
                    ? lv === "high"
                      ? "原双高采信"
                      : "原双低维持"
                    : "原未解冻"}
                </span>
              </h4>
              <p>归档于 {shortIso(a.archivedAt)} · 失效原因：{a.reason}</p>
              <p>
                甲：{a.review.reviewerA ? `${a.review.reviewerA.level === "high" ? "高" : "低"}置信｜${a.review.reviewerA.reason}` : "未交档"}
              </p>
              <p>
                乙：{a.review.reviewerB ? `${a.review.reviewerB.level === "high" ? "高" : "低"}置信｜${a.review.reviewerB.reason}` : "未交档"}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
