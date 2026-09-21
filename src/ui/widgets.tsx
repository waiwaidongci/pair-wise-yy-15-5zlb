import type { ReactNode } from "react";
import { useEffect, useState, useCallback, createContext, useContext } from "react";
import type {
  LegStatus,
  Resolution,
  RiskLevel,
} from "../domain/model";

/* ---------------- 状态徽章 ---------------- */

export const STATUS_META: Record<LegStatus, { text: string; cls: string }> = {
  ok: { text: "连续可信·已到家", cls: "badge-ok" },
  disputed: { text: "争议段冻结", cls: "badge-bad" },
  inflight: { text: "在飞未归", cls: "badge-warn" },
  missing: { text: "档案缺失", cls: "badge-bad" },
};

export const RISK_META: Record<RiskLevel, { text: string; cls: string }> = {
  none: { text: "风险无", cls: "risk-none" },
  low: { text: "风险低", cls: "risk-low" },
  mid: { text: "风险中", cls: "risk-mid" },
  high: { text: "风险高", cls: "risk-high" },
};

export function StatusBadge({ status }: { status: LegStatus }) {
  const m = STATUS_META[status];
  return <span className={`badge ${m.cls}`}>{m.text}</span>;
}

export function RiskBadge({ risk }: { risk: RiskLevel }) {
  const m = RISK_META[risk];
  return <span className={`badge ${m.cls}`}>{m.text}</span>;
}

export function ResolutionBadge({ resolution }: { resolution: Resolution }) {
  if (resolution.frozen) {
    const filled = resolution.reviews.length;
    return (
      <span className="badge badge-bad">
        未解（{filled}/2 复核）
      </span>
    );
  }
  if (resolution.kind === "accept")
    return <span className="badge badge-ok">双高采信·已解冻</span>;
  if (resolution.kind === "reject")
    return <span className="badge badge-bad">双低驳回·未归巢</span>;
  return <span className="badge badge-warn">双中补测·暂不计</span>;
}

/* ---------------- Modal ---------------- */

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  wide?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="modal-mask" onClick={onClose}>
      <div
        className={`modal ${wide ? "modal-wide" : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

/* ---------------- Toast ---------------- */

interface ToastItem {
  id: number;
  text: string;
  tone: "ok" | "err" | "info";
}

const ToastContext = createContext<(text: string, tone?: ToastItem["tone"]) => void>(
  () => {}
);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const push = useCallback((text: string, tone: ToastItem["tone"] = "info") => {
    const id = Date.now() + Math.random();
    setItems((list) => [...list, { id, text, tone }]);
    window.setTimeout(() => {
      setItems((list) => list.filter((t) => t.id !== id));
    }, 3200);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="toast-stack">
        {items.map((t) => (
          <div key={t.id} className={`toast toast-${t.tone}`}>
            {t.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

/* ---------------- 杂项 ---------------- */

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span className="field-label">
        {label}
        {hint ? <em className="field-hint">{hint}</em> : null}
      </span>
      {children}
    </label>
  );
}

export function useNowTick(intervalMs = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(t);
  }, [intervalMs]);
  return now;
}
