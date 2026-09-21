import { useMemo, useState } from "react";
import { useStore, uid } from "../store/store";
import { useDerived } from "../store/useDerived";
import {
  CONFIDENCE_LABEL,
  formatDateTime,
  ISSUE_LABELS,
  resolveReviews,
  toLocalDateTime,
  type LegAnalysis,
} from "../domain/model";
import {
  Field,
  Modal,
  ResolutionBadge,
  RiskBadge,
  StatusBadge,
  useToast,
} from "./widgets";
import type { ClockPunch } from "../domain/types";

const EMPTY_FORM = {
  ringId: "",
  siteId: "",
  clockId: "",
  releaseLocal: "",
  weather: "",
};

export function Legs({
  focusLegId,
  clearFocus,
}: {
  focusLegId?: string;
  clearFocus: () => void;
}) {
  const { state, addLeg, addPunch, removePunch, removeLeg } = useStore();
  const d = useDerived();
  const toast = useToast();
  const [form, setForm] = useState(EMPTY_FORM);
  const [openLeg, setOpenLeg] = useState<string | null>(focusLegId ?? null);
  const [showCreate, setShowCreate] = useState(false);

  const activeId = openLeg ?? focusLegId ?? null;
  const active = activeId ? d.analysisById.get(activeId) : undefined;

  const sorted = useMemo(
    () =>
      [...d.analyses].sort(
        (a, b) => b.releaseUtc - a.releaseUtc || a.leg.createdAt - b.leg.createdAt
      ),
    [d.analyses]
  );

  function submitLeg() {
    if (!form.ringId || !form.siteId || !form.clockId || !form.releaseLocal) {
      toast("请完整填写足环、放飞地、鸽钟与放飞时刻", "err");
      return;
    }
    const res = addLeg({
      id: uid("leg"),
      ringId: form.ringId,
      siteId: form.siteId,
      clockId: form.clockId,
      releaseLocal: form.releaseLocal,
      weather: form.weather,
      punches: [],
      createdAt: Date.now(),
    });
    toast(res.message, res.ok ? "ok" : "err");
    if (res.ok) {
      setForm(EMPTY_FORM);
      setShowCreate(false);
    }
  }

  return (
    <div className="legs-layout">
      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="panel-kicker">足环号 + 放飞时刻 + 放飞地点 = 唯一赛程</p>
            <h2>赛程复测队列</h2>
          </div>
          <button className="primary" onClick={() => setShowCreate(true)}>
            ＋ 建立赛程
          </button>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th>足环号</th>
              <th>放飞地 / 时区</th>
              <th>放飞时刻（本地）</th>
              <th>鸽钟校准</th>
              <th>报时点</th>
              <th>连续可信段</th>
              <th>状态 / 风险</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((a) => {
              const resolution = resolveReviews(
                a.leg.id,
                state.reviews,
                a.issueSignature,
                d.reviewerIds
              );
              return (
                <tr
                  key={a.leg.id}
                  className="row-clickable"
                  onClick={() => setOpenLeg(a.leg.id)}
                >
                  <td className="mono">{a.ring?.ringNo ?? "缺档"}</td>
                  <td>
                    {a.site?.name ?? "—"}
                    <small className="dim">
                      {" "}
                      UTC{(a.site?.offsetMin ?? 0) / 60}
                    </small>
                  </td>
                  <td>{formatDateTime(a.leg.releaseLocal)}</td>
                  <td>
                    {a.clock?.name ?? "—"}
                    {a.clock && a.clock.deltaSec !== 0 && (
                      <small className="dim">
                        {" "}
                        ({a.clock.deltaSec > 0 ? "快" : "慢"}{" "}
                        {Math.abs(a.clock.deltaSec)}s)
                      </small>
                    )}
                  </td>
                  <td>{a.leg.punches.length}</td>
                  <td>
                    {a.trustedPrefixCount}
                    {a.trustedHomeIndex > 0 && (
                      <small className="dim">（至第 {a.trustedHomeIndex} 点到家）</small>
                    )}
                  </td>
                  <td>
                    <div className="badge-stack">
                      <StatusBadge status={a.status} />
                      <RiskBadge risk={a.risk} />
                      {a.status === "disputed" && (
                        <ResolutionBadge resolution={resolution} />
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={7} className="empty">
                  还没有赛程，点击「建立赛程」开始
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="建立唯一赛程"
        wide
      >
        <div className="form-grid">
          <Field label="足环档案">
            <select
              value={form.ringId}
              onChange={(e) => setForm({ ...form, ringId: e.target.value })}
            >
              <option value="">选择足环号</option>
              {state.rings.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.ringNo}（{r.bloodline}·{r.sex}）
                </option>
              ))}
            </select>
          </Field>
          <Field label="放飞地点" hint="含时区与全程">
            <select
              value={form.siteId}
              onChange={(e) => setForm({ ...form, siteId: e.target.value })}
            >
              <option value="">选择放飞地</option>
              {state.sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} · UTC{s.offsetMin / 60} · {s.totalKm}km
                </option>
              ))}
            </select>
          </Field>
          <Field label="鸽钟" hint="含校准偏差">
            <select
              value={form.clockId}
              onChange={(e) => setForm({ ...form, clockId: e.target.value })}
            >
              <option value="">选择鸽钟</option>
              {state.clocks.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="放飞时刻" hint="放飞地本地钟面">
            <input
              type="datetime-local"
              step="1"
              value={form.releaseLocal}
              onChange={(e) =>
                setForm({ ...form, releaseLocal: e.target.value })
              }
            />
          </Field>
          <Field label="天气 / 备注">
            <input
              value={form.weather}
              onChange={(e) => setForm({ ...form, weather: e.target.value })}
              placeholder="如：晴，西北风 2 级"
            />
          </Field>
        </div>
        <p className="form-note">
          同一足环在同一放飞地点、同一放飞时刻只允许一条赛程；重复建立将被拒绝。
        </p>
        <div className="modal-actions">
          <button onClick={() => setShowCreate(false)}>取消</button>
          <button className="primary" onClick={submitLeg}>
            建立并开始复测
          </button>
        </div>
      </Modal>

      <Modal
        open={!!active}
        onClose={() => {
          setOpenLeg(null);
          clearFocus();
        }}
        title={
          active ? (
            <span>
              报时链复测 · <span className="mono">{active.ring?.ringNo}</span>
            </span>
          ) : (
            ""
          )
        }
        wide
      >
        {active && (
          <LegDetail
            analysis={active}
            onAddPunch={(p) => {
              addPunch(active.leg.id, p);
              toast("报时已录入，矛盾点与连续可信段已重算", "ok");
            }}
            onRemovePunch={(pid) => {
              removePunch(active.leg.id, pid);
              toast("报时段已移除，排行/风险/配对已重算", "info");
            }}
            onRemoveLeg={() => {
              removeLeg(active.leg.id);
              setOpenLeg(null);
              clearFocus();
              toast("赛程及其复核记录已删除", "info");
            }}
          />
        )}
      </Modal>
    </div>
  );
}

/* ---------------- 赛程详情：报时链分段表 ---------------- */

function LegDetail({
  analysis: a,
  onAddPunch,
  onRemovePunch,
  onRemoveLeg,
}: {
  analysis: LegAnalysis;
  onAddPunch: (p: ClockPunch) => void;
  onRemovePunch: (punchId: string) => void;
  onRemoveLeg: () => void;
}) {
  const { state } = useStore();
  const toast = useToast();
  const [clockLocal, setClockLocal] = useState("");
  const [cumKm, setCumKm] = useState("");
  const [note, setNote] = useState("");
  const resolution = resolveReviews(
    a.leg.id,
    state.reviews,
    a.issueSignature,
    state.reviewers.map((r) => r.id)
  );

  const releaseLocal = a.site
    ? toLocalDateTime(a.releaseUtc, a.site.offsetMin)
    : a.leg.releaseLocal;

  function add() {
    const km = parseFloat(cumKm);
    if (!clockLocal || Number.isNaN(km)) {
      toast("请填写钟面时刻与累计航距", "err");
      return;
    }
    onAddPunch({ id: uid("p"), clockLocal, cumKm: km, note: note || undefined });
    setClockLocal("");
    setCumKm("");
    setNote("");
  }

  return (
    <div className="leg-detail">
      <div className="detail-meta">
        <div>
          <small>放飞地</small>
          <b>
            {a.site?.name ?? "档案缺失"} · UTC{(a.site?.offsetMin ?? 0) / 60}
          </b>
        </div>
        <div>
          <small>放飞时刻（校正后本地）</small>
          <b>{formatDateTime(releaseLocal)}</b>
        </div>
        <div>
          <small>鸽钟校准</small>
          <b>
            {a.clock?.name ?? "档案缺失"}
            {a.clock && a.clock.deltaSec !== 0
              ? `（${a.clock.deltaSec > 0 ? "快" : "慢"} ${Math.abs(
                  a.clock.deltaSec
                )}s）`
              : ""}
          </b>
        </div>
        <div>
          <small>司放全程 / 限速</small>
          <b>
            {a.site ? `${a.totalKm}km` : "—"} · {state.maxMpm} m/min
          </b>
        </div>
        <div>
          <small>天气</small>
          <b>{a.leg.weather || "—"}</b>
        </div>
      </div>

      <div className="detail-status">
        <StatusBadge status={a.status} />
        <RiskBadge risk={a.risk} />
        {a.status === "disputed" && <ResolutionBadge resolution={resolution} />}
        {a.avgMpm !== null && (
          <span className="badge badge-info">
            连续可信到家均速 {a.avgMpm} m/min
          </span>
        )}
      </div>

      {a.issues.length > 0 && (
        <div className="issue-box">
          <b>本赛程矛盾点指纹：</b>
          <code>{a.issueSignature}</code>
          <p>
            {a.issues.map((c) => ISSUE_LABELS[c]).join("；")}。
            首个矛盾点之后的报时段全部中断，不参与排行；请前往「争议复核」由两名复核人解冻。
          </p>
        </div>
      )}

      <table className="data-table punch-table">
        <thead>
          <tr>
            <th>#</th>
            <th>钟面时刻</th>
            <th>校正时刻(UTC)</th>
            <th>累计航距</th>
            <th>分段距离</th>
            <th>分段耗时</th>
            <th>分段速度</th>
            <th>判定</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr className="row-release">
            <td>0</td>
            <td>{formatDateTime(releaseLocal)}</td>
            <td>{new Date(a.releaseUtc).toISOString().replace("T", " ").slice(0, 19)}</td>
            <td>0 km</td>
            <td colSpan={3}>放飞点</td>
            <td>
              <span className="dim">基准</span>
            </td>
            <td></td>
          </tr>
          {a.points.map((p) => (
            <tr key={p.punch.id} className={p.trusted ? "" : "row-bad"}>
              <td>{p.index}</td>
              <td>{formatDateTime(p.punch.clockLocal)}</td>
              <td>
                {Number.isNaN(p.utcMs)
                  ? "无效时刻"
                  : new Date(p.utcMs).toISOString().replace("T", " ").slice(0, 19)}
              </td>
              <td>{p.cumKm} km</td>
              <td>{p.segment ? `${p.segment.distanceKm} km` : "—"}</td>
              <td>{p.segment ? `${p.segment.elapsedMin} 分` : "—"}</td>
              <td>
                {p.segment ? (
                  <span
                    className={
                      p.segment.speedMpm > state.maxMpm ? "speed-over" : "speed-ok"
                    }
                  >
                    {p.segment.speedMpm} m/min
                  </span>
                ) : (
                  "—"
                )}
              </td>
              <td>
                {p.issues.length ? (
                  <span className="badge badge-bad">
                    {p.issues.map((c) => ISSUE_LABELS[c]).join("；")}
                  </span>
                ) : p.trusted ? (
                  <span className="badge badge-ok">
                    可信{a.trustedHomeIndex === p.index ? "·到家" : ""}
                  </span>
                ) : (
                  <span className="badge badge-warn">中断后不计</span>
                )}
              </td>
              <td>
                <button
                  className="icon-btn"
                  title="删除该报时（重算）"
                  onClick={() => onRemovePunch(p.punch.id)}
                >
                  删除
                </button>
              </td>
            </tr>
          ))}
          {a.points.length === 0 && (
            <tr>
              <td colSpan={9} className="empty">
                尚无报时点
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="add-punch">
        <h4>录入鸽钟报时段</h4>
        <p className="dim">
          报时按递增时刻自动排序；新增/删除报时立即重算矛盾点、连续可信段、排行、风险与配对，
          针对旧矛盾的复核自动标记失效。
        </p>
        <div className="form-grid form-grid-3">
          <Field label="钟面本地时刻">
            <input
              type="datetime-local"
              step="1"
              value={clockLocal}
              onChange={(e) => setClockLocal(e.target.value)}
            />
          </Field>
          <Field label="累计航距（公里）">
            <input
              type="number"
              step="0.1"
              min="0"
              value={cumKm}
              onChange={(e) => setCumKm(e.target.value)}
              placeholder={`不超过 ${a.site ? a.totalKm + state.toleranceKm : "—"}km`}
            />
          </Field>
          <Field label="备注">
            <input value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
        </div>
        <div className="modal-actions">
          <button className="danger-ghost" onClick={onRemoveLeg}>
            删除整条赛程
          </button>
          <button className="primary" onClick={add}>
            录入报时并重算
          </button>
        </div>
      </div>

      {(resolution.reviews.length > 0 || resolution.stale.length > 0) && (
        <div className="review-box">
          <h4>复核记录</h4>
          {resolution.stale.map((r) => (
            <ReviewItem key={r.id} id={r.id} stale />
          ))}
          {resolution.reviews.map((r) => (
            <ReviewItem key={r.id} id={r.id} />
          ))}
          <p className="resolution-note">{resolution.note}</p>
        </div>
      )}
    </div>
  );
}

function ReviewItem({ id, stale }: { id: string; stale?: boolean }) {
  const { state } = useStore();
  const r = state.reviews.find((x) => x.id === id);
  const reviewer = state.reviewers.find((x) => x.id === r?.reviewerId);
  if (!r) return null;
  return (
    <div className={`review-item ${stale ? "review-stale" : ""}`}>
      <b>
        {reviewer?.name ?? r.reviewerId} · {CONFIDENCE_LABEL[r.confidence]}
        {stale && <span className="tag-stale">问题指纹已变·失效</span>}
      </b>
      <p>{r.reason}</p>
    </div>
  );
}
