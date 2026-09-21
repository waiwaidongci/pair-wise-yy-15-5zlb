import { useState } from "react";
import { useStore } from "../store/store";
import { useDerived } from "../store/useDerived";
import {
  CONFIDENCE_LABEL,
  formatDateTime,
  ISSUE_LABELS,
  resolveReviews,
  type Confidence,
  type LegAnalysis,
} from "../domain/model";
import { Field, Modal, ResolutionBadge, RiskBadge, useToast } from "./widgets";

export function Disputes() {
  const { state } = useStore();
  const d = useDerived();
  const disputed = d.analyses.filter((a) => a.status === "disputed");
  const [detailId, setDetailId] = useState<string | null>(null);
  const detail = detailId ? d.analysisById.get(detailId) : undefined;

  return (
    <div className="dispute-layout">
      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="panel-kicker">
              争议段冻结：不进排行、不计未归巢；两名复核人同档一致才解冻
            </p>
            <h2>争议队列（{disputed.length}）</h2>
          </div>
        </div>

        {disputed.length === 0 ? (
          <p className="empty">当前没有待复核的争议赛程。</p>
        ) : (
          <div className="dispute-cards">
            {disputed.map((a) => {
              const r = resolveReviews(
                a.leg.id,
                state.reviews,
                a.issueSignature,
                d.reviewerIds
              );
              return (
                <article
                  key={a.leg.id}
                  className={`dispute-card ${r.frozen ? "" : "dispute-resolved"}`}
                  onClick={() => setDetailId(a.leg.id)}
                >
                  <div className="dispute-top">
                    <div>
                      <b className="mono">{a.ring?.ringNo ?? "缺档"}</b>
                      <span>{a.site?.name}</span>
                    </div>
                    <div className="badge-stack">
                      <RiskBadge risk={a.risk} />
                      <ResolutionBadge resolution={r} />
                    </div>
                  </div>
                  <p className="dispute-issues">
                    {a.issues.map((c) => ISSUE_LABELS[c]).join("；")}
                  </p>
                  <div className="dispute-reviewers">
                    {state.reviewers.map((rv) => {
                      const got = r.reviews.find((x) => x.reviewerId === rv.id);
                      return (
                        <span
                          key={rv.id}
                          className={`chip chip-${got ? "filled" : "empty"}`}
                        >
                          {rv.name}：
                          {got ? CONFIDENCE_LABEL[got.confidence].split("·")[0] : "未提请"}
                        </span>
                      );
                    })}
                  </div>
                  <p className="dispute-note">{r.note}</p>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <Modal
        open={!!detail}
        onClose={() => setDetailId(null)}
        title="争议复核"
        wide
      >
        {detail && (
          <DisputeDetail
            analysis={detail}
            onSubmitted={() => setDetailId(null)}
          />
        )}
      </Modal>
    </div>
  );
}

function DisputeDetail({
  analysis: a,
  onSubmitted,
}: {
  analysis: LegAnalysis;
  onSubmitted: () => void;
}) {
  const { state, addReview } = useStore();
  const toast = useToast();
  const [reviewerId, setReviewerId] = useState(state.reviewers[0]?.id ?? "");
  const [confidence, setConfidence] = useState<Confidence>("high");
  const [reason, setReason] = useState("");

  const r = resolveReviews(
    a.leg.id,
    state.reviews,
    a.issueSignature,
    d_reviewerIds(state)
  );
  const mine = r.reviews.find((x) => x.reviewerId === reviewerId);

  function submit() {
    const res = addReview(a.leg.id, reviewerId, confidence, reason, a.issueSignature);
    toast(res.message, res.ok ? "ok" : "err");
    if (res.ok) {
      setReason("");
      onSubmitted();
    }
  }

  return (
    <div className="leg-detail">
      <div className="detail-meta">
        <div>
          <small>足环 / 放飞地</small>
          <b>
            {a.ring?.ringNo} · {a.site?.name}
          </b>
        </div>
        <div>
          <small>放飞时刻</small>
          <b>{formatDateTime(a.leg.releaseLocal)}</b>
        </div>
        <div>
          <small>连续可信段</small>
          <b>
            {a.trustedPrefixCount} 段
            {a.trustedHomeIndex > 0 ? `（第 ${a.trustedHomeIndex} 点到家）` : "（未到家）"}
          </b>
        </div>
      </div>

      <div className="issue-box">
        <b>矛盾点指纹（数据一变即更新，旧复核随之失效）</b>
        <code>{a.issueSignature}</code>
        <ul>
          {a.points
            .filter((p) => p.issues.length > 0)
            .map((p) => (
              <li key={p.punch.id}>
                第 {p.index} 报时点（{formatDateTime(p.punch.clockLocal)}，累计{" "}
                {p.cumKm}km）：
                {p.issues.map((c) => ISSUE_LABELS[c]).join("；")}
              </li>
            ))}
        </ul>
      </div>

      <h4>已提交的置信档</h4>
      <div className="review-grid">
        {state.reviewers.map((rv) => {
          const got = r.reviews.find((x) => x.reviewerId === rv.id);
          const stale = r.stale.find((x) => x.reviewerId === rv.id);
          return (
            <div key={rv.id} className={`review-slot ${got ? "slot-filled" : ""}`}>
              <small>
                {rv.name}（{rv.role}）
              </small>
              {got ? (
                <>
                  <b>{CONFIDENCE_LABEL[got.confidence]}</b>
                  <p>{got.reason}</p>
                </>
              ) : stale ? (
                <>
                  <b className="dim">旧提请已失效</b>
                  <p className="dim">{stale.reason}</p>
                </>
              ) : (
                <b className="dim">尚未提请</b>
              )}
            </div>
          );
        })}
      </div>
      <p className="resolution-note">{r.note}</p>

      {!r.frozen ? (
        <div className="unfreeze-box">
          解冻结论：
          {r.kind === "accept"
            ? "双高一致采信，连续可信段按复核结论延伸，赛程已回到排行。"
            : r.kind === "reject"
            ? "双低一致驳回，该赛程按未归巢计。"
            : "双中一致，进入补测：暂不排行、暂不记未归巢，等待补充报时。"}
        </div>
      ) : (
        <div className="submit-review">
          <h4>提交置信档</h4>
          <div className="form-grid">
            <Field label="复核人">
              <select
                value={reviewerId}
                onChange={(e) => setReviewerId(e.target.value)}
              >
                {state.reviewers.map((rv) => (
                  <option key={rv.id} value={rv.id}>
                    {rv.name}（{rv.role}）
                  </option>
                ))}
              </select>
            </Field>
            <Field label="置信档" hint="同档一致才解冻">
              <select
                value={confidence}
                onChange={(e) => setConfidence(e.target.value as Confidence)}
                disabled={!!mine}
              >
                <option value="high">高置信 · 建议采信（进排行）</option>
                <option value="mid">中置信 · 存疑补测（暂均不计）</option>
                <option value="low">低置信 · 建议驳回（计未归巢）</option>
              </select>
            </Field>
          </div>
          <Field label="复核原因">
            <textarea
              rows={3}
              value={reason}
              disabled={!!mine}
              onChange={(e) => setReason(e.target.value)}
              placeholder="说明采信/驳回依据，如设备日志、感应点原始记录、天气佐证……"
            />
          </Field>
          <div className="modal-actions">
            {mine ? (
              <em className="dim">
                该复核人已提交首条（{CONFIDENCE_LABEL[mine.confidence]}），重复提请沿用首条，不可覆盖。
              </em>
            ) : (
              <button className="primary" onClick={submit}>
                提交置信档
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function d_reviewerIds(state: ReturnType<typeof useStore>["state"]) {
  return state.reviewers.map((r) => r.id);
}
