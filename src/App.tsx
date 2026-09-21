import { useEffect, useState } from "react";
import "./styles.css";
import { StoreProvider, useStore } from "./store/store";
import { ToastProvider } from "./ui/widgets";
import { Overview } from "./ui/Overview";
import { Legs } from "./ui/Legs";
import { Ranking } from "./ui/Ranking";
import { Disputes } from "./ui/Disputes";
import { Timeline } from "./ui/Timeline";
import { Params } from "./ui/Params";
import { Versions } from "./ui/Versions";
import { useDerived } from "./store/useDerived";
import { resolveReviews } from "./domain/model";

type TabId = "overview" | "legs" | "ranking" | "disputes" | "timeline" | "params" | "versions";

const TABS: { id: TabId; label: string }[] = [
  { id: "overview", label: "鸽棚总览" },
  { id: "legs", label: "赛程复测台" },
  { id: "ranking", label: "成绩排行" },
  { id: "disputes", label: "争议复核" },
  { id: "timeline", label: "航迹时间轴" },
  { id: "params", label: "判定参数档案" },
  { id: "versions", label: "版本存档" },
];

function Shell() {
  const { state } = useStore();
  const d = useDerived();
  const [tab, setTab] = useState<TabId>("overview");
  const [focusLegId, setFocusLegId] = useState<string | undefined>();
  const [flash, setFlash] = useState(false);

  // 参数版本变化 → “排行/风险/配对失效重算”闪动提示
  const version = state.version;
  useEffect(() => {
    setFlash(true);
    const t = window.setTimeout(() => setFlash(false), 1400);
    return () => window.clearTimeout(t);
  }, [version]);

  const disputeCount = d.analyses.filter(
    (a) =>
      a.status === "disputed" &&
      resolveReviews(a.leg.id, state.reviews, a.issueSignature, d.reviewerIds)
        .frozen
  ).length;

  function go(next: string, legId?: string) {
    setTab(next as TabId);
    if (legId) setFocusLegId(legId);
  }

  return (
    <main className="app app-recheck">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">鸽</div>
          <div>
            <h1>离线航迹可信度复测台</h1>
            <p>赛鸽训放 · 多段鸽钟报时 · 连续可信段排行 · 双人复核解冻</p>
          </div>
        </div>
        <div className="topbar-side">
          <span className={`version-tag ${flash ? "version-flash" : ""}`}>
            档案 v{state.version}
          </span>
          <span className="offline-tag" title="全部数据仅保存在本机浏览器">
            ● 离线模式
          </span>
        </div>
      </header>

      <nav className="tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`tab ${tab === t.id ? "tab-active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            {t.id === "disputes" && disputeCount > 0 && (
              <span className="tab-dot">{disputeCount}</span>
            )}
          </button>
        ))}
      </nav>

      {flash && (
        <div className="recalc-banner">
          判定参数已变更：排行、风险等级与配对提示已失效并重算；上一版已只读冻结。
        </div>
      )}

      <div className="tab-body">
        {tab === "overview" && <Overview onGo={go} />}
        {tab === "legs" && (
          <Legs focusLegId={focusLegId} clearFocus={() => setFocusLegId(undefined)} />
        )}
        {tab === "ranking" && (
          <Ranking
            onOpenLeg={(id) => {
              setFocusLegId(id);
              setTab("legs");
            }}
          />
        )}
        {tab === "disputes" && <Disputes />}
        {tab === "timeline" && <Timeline />}
        {tab === "params" && <Params />}
        {tab === "versions" && <Versions />}
      </div>

      <footer className="footer">
        数据仅存于本机 localStorage：赛程 / 争议队列 / 时间轴由同一档案实时派生，
        刷新页面后保持一致；参数发布前的旧版快照只读保留
      </footer>
    </main>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <ToastProvider>
        <Shell />
      </ToastProvider>
    </StoreProvider>
  );
}
