import { useMemo, useState } from "react";
import { useDerived } from "../store/useDerived";
import { useStore } from "../store/store";
import type { TimelineEvent } from "../domain/model";

const TONE_LABEL = {
  release: "放飞",
  punch: "报时",
  issue: "矛盾",
  review: "复核",
} as const;

export function Timeline() {
  const d = useDerived();
  const { state } = useStore();
  const [ringFilter, setRingFilter] = useState("all");
  const [kindFilter, setKindFilter] = useState<"all" | TimelineEvent["kind"]>(
    "all"
  );

  const events = useMemo(
    () =>
      d.timeline.filter(
        (e) =>
          (kindFilter === "all" || e.kind === kindFilter) &&
          (ringFilter === "all" ||
            d.analysisById.get(e.legId)?.leg.ringId === ringFilter)
      ),
    [d.timeline, d.analysisById, kindFilter, ringFilter]
  );

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <p className="panel-kicker">
            赛程、争议队列与本时间轴由同一份本地档案派生，刷新后保持一致
          </p>
          <h2>航迹时间轴（UTC 标准时排序）</h2>
        </div>
        <div className="filter-row">
          <select
            value={ringFilter}
            onChange={(e) => setRingFilter(e.target.value)}
          >
            <option value="all">全部足环</option>
            {state.rings.map((r) => (
              <option key={r.id} value={r.id}>
                {r.ringNo}
              </option>
            ))}
          </select>
          <select
            value={kindFilter}
            onChange={(e) =>
              setKindFilter(e.target.value as typeof kindFilter)
            }
          >
            <option value="all">全部事件</option>
            <option value="release">放飞</option>
            <option value="punch">可信报时</option>
            <option value="issue">矛盾点</option>
            <option value="review">复核</option>
          </select>
        </div>
      </div>

      <ol className="timeline">
        {events.map((e) => {
          const utc = new Date(e.atMs);
          return (
            <li key={e.id} className={`tl-item tl-${e.tone}`}>
              <div className="tl-time">
                <b>
                  {utc
                    .toISOString()
                    .replace("T", " ")
                    .slice(5, 16)}
                </b>
                <small>UTC</small>
              </div>
              <div className="tl-dot" />
              <div className="tl-card">
                <div className="tl-title">
                  <span className={`tl-kind tl-kind-${e.kind}`}>
                    {TONE_LABEL[e.kind]}
                  </span>
                  <b>{e.title}</b>
                  {e.ringLabel && <em className="mono">{e.ringLabel}</em>}
                </div>
                <p>{e.detail}</p>
                {e.siteName && <small className="dim">@ {e.siteName}</small>}
              </div>
            </li>
          );
        })}
        {events.length === 0 && <li className="empty">没有匹配的事件</li>}
      </ol>
    </section>
  );
}
