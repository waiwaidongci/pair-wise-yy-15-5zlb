import { useState } from "react";
import type { ConfidenceLevel, RaceAnalysis, Review, ReviewVote } from "../types";
import { nowIso } from "../lib/time";
import { shortIso } from "../lib/format";

interface Props {
  analysis: RaceAnalysis;
  onSubmitVote: (who: "A" | "B", vote: ReviewVote) => void;
  onReset: () => void;
}

const REVIEWERS = [
  { key: "A" as const, name: "复核人甲" },
  { key: "B" as const, name: "复核人乙" },
];

function LevelPicker({
  value,
  onChange,
  disabled,
}: {
  value?: ConfidenceLevel;
  onChange: (v: ConfidenceLevel) => void;
  disabled?: boolean;
}) {
  return (
    <div className="seg-group">
      <button
        className={value === "high" ? "active" : ""}
        disabled={disabled}
        onClick={() => onChange("high")}
      >
        高置信
      </button>
      <button
        className={value === "low" ? "active" : ""}
        disabled={disabled}
        onClick={() => onChange("low")}
      >
        低置信
      </button>
    </div>
  );
}

export function ReviewPanel({ analysis, onSubmitVote, onReset }: Props) {
  const review = analysis.review;
  const [drafts, setDrafts] = useState<Record<string, { level?: ConfidenceLevel; reason: string }>>({});

  const status = review?.status;

  return (
    <div className="review-box">
      <div className="inline" style={{ justifyContent: "space-between" }}>
        <strong>双人复核解冻</strong>
        {status === "unfrozen" ? (
          <span className="badge ok">已一致解冻</span>
        ) : status === "pending" ? (
          <span className="badge warn">等待第二票 · 冻结中</span>
        ) : (
          <span className="badge danger">争议段冻结 · 不计未归巢</span>
        )}
      </div>

      {review?.firstRequestedAt && (
        <p className="muted" style={{ margin: 0 }}>
          首次提请：{shortIso(review.firstRequestedAt)}
          （同签名重复提请沿用首条，不另立案）
        </p>
      )}

      <div className="review-grid">
        {REVIEWERS.map((r) => {
          const vote: ReviewVote | undefined =
            r.key === "A" ? review?.reviewerA : review?.reviewerB;
          const draft = drafts[r.key] ?? { reason: "" };
          const locked = status === "unfrozen" || !!vote;
          return (
            <div key={r.key} className="reviewer">
              <h5>
                {r.name}
                {vote ? (
                  <span
                    className={`badge ${vote.level === "high" ? "ok" : "warn"}`}
                  >
                    {vote.level === "high" ? "高置信" : "低置信"}
                  </span>
                ) : (
                  <span className="badge muted">未交档</span>
                )}
              </h5>
              <LevelPicker
                value={vote?.level ?? draft.level}
                disabled={locked}
                onChange={(level) =>
                  setDrafts((d) => ({ ...d, [r.key]: { ...d[r.key], level } }))
                }
              />
              <textarea
                placeholder="填写置信原因（必填）"
                disabled={locked}
                value={vote?.reason ?? draft.reason}
                onChange={(e) =>
                  setDrafts((d) => ({
                    ...d,
                    [r.key]: { ...d[r.key], reason: e.target.value },
                  }))
                }
              />
              {vote && <p className="muted" style={{ margin: 0 }}>交档 {shortIso(vote.at)}</p>}
              {!locked && (
                <button
                  className="primary"
                  disabled={!draft.level || !draft.reason.trim()}
                  onClick={() =>
                    onSubmitVote(r.key, {
                      level: draft.level!,
                      reason: draft.reason.trim(),
                      at: nowIso(),
                    })
                  }
                >
                  提交置信档
                </button>
              )}
            </div>
          );
        })}
      </div>

      {status === "pending" && (
        <p className="muted" style={{ margin: 0 }}>
          两人置信档一致（同高或同低）才解冻：同高→争议段采信重入排行；同低→维持不计未归巢。
        </p>
      )}
      {status === "unfrozen" && (
        <div className="inline" style={{ justifyContent: "space-between" }}>
          <span className="muted">
            一致结论：
            {review?.reviewerA?.level === "high"
              ? "双高置信，争议段解冻采信"
              : "双低置信，争议段维持不计"}
          </span>
          <button className="ghost danger" onClick={onReset}>
            撤回复核（重开）
          </button>
        </div>
      )}
    </div>
  );
}

export function createReview(raceId: string, issueSignature: string): Review {
  return {
    raceId,
    issueSignature,
    status: "frozen",
    firstRequestedAt: nowIso(),
  };
}
