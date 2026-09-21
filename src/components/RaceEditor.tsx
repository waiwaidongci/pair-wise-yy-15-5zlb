import { useEffect, useState } from "react";
import type { ClockReport, Race } from "../types";
import { TZ_OPTIONS } from "../lib/seed";

interface Props {
  race: Race;
  onSaveRace: (race: Race) => void;
  onDelete: () => void;
}

export function RaceEditor({ race, onSaveRace, onDelete }: Props) {
  const [draft, setDraft] = useState<Race>(race);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  // 切换赛程时重置草稿
  useEffect(() => {
    setDraft(race);
    setSavedAt(null);
  }, [race]);

  const set = <K extends keyof Race>(key: K, value: Race[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const setReport = (id: string, patch: Partial<ClockReport>) =>
    setDraft((d) => ({
      ...d,
      reports: d.reports.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    }));

  const addReport = () => {
    const n = draft.reports.length + 1;
    const last = draft.reports[draft.reports.length - 1];
    const next: ClockReport = {
      id: `${draft.id}-p${n}-${Date.now().toString(36)}`,
      name: `计时点 ${n}`,
      lat: last ? last.lat : draft.releaseLat,
      lng: last ? last.lng : draft.releaseLng,
      clockTime: last ? last.clockTime : draft.releaseTime,
      cumKm: last ? last.cumKm : 0,
      home: false,
      clockOffsetSec: 0,
    };
    set("reports", [...draft.reports, next]);
  };

  const removeReport = (id: string) =>
    set(
      "reports",
      draft.reports.filter((r) => r.id !== id)
    );

  const save = () => {
    // 按时间排序后落库，保证时间轴稳定
    const reports = [...draft.reports].sort((a, b) =>
      a.clockTime.localeCompare(b.clockTime)
    );
    onSaveRace({ ...draft, reports });
    setSavedAt(Date.now());
  };

  return (
    <div className="stack">
      <div className="panel">
        <div className="section-title">
          <div>
            <h2>赛程参数</h2>
            <p>
              足环号 / 放飞时刻地点 / 时区 / 各点鸽钟校准任一变更，排行·风险·配对·复核全部失效重算
            </p>
          </div>
          <button className="danger ghost" onClick={onDelete}>
            删除赛程
          </button>
        </div>

        <div className="form-grid">
          <label className="field">
            足环号
            <input
              type="text"
              value={draft.ringNo}
              onChange={(e) => set("ringNo", e.target.value.trim())}
            />
          </label>
          <label className="field">
            血统
            <input
              type="text"
              value={draft.bloodline}
              onChange={(e) => set("bloodline", e.target.value)}
            />
          </label>
          <label className="field span2">
            放飞地点
            <input
              type="text"
              value={draft.releaseName}
              onChange={(e) => set("releaseName", e.target.value)}
            />
          </label>
          <label className="field">
            放飞纬度
            <input
              type="number"
              step="0.0001"
              value={draft.releaseLat}
              onChange={(e) => set("releaseLat", Number(e.target.value))}
            />
          </label>
          <label className="field">
            放飞经度
            <input
              type="number"
              step="0.0001"
              value={draft.releaseLng}
              onChange={(e) => set("releaseLng", Number(e.target.value))}
            />
          </label>
          <label className="field">
            放飞地时区
            <select
              value={draft.timeZone}
              onChange={(e) => set("timeZone", e.target.value)}
            >
              {TZ_OPTIONS.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            放飞时刻（当地墙钟）
            <input
              type="datetime-local"
              value={draft.releaseTime}
              onChange={(e) => set("releaseTime", e.target.value)}
            />
          </label>
          <label className="field span2">
            分段限速（m/min，段速超过即判矛盾）
            <input
              type="number"
              value={draft.speedLimitMpm}
              onChange={(e) => set("speedLimitMpm", Number(e.target.value))}
            />
          </label>
        </div>

        <hr className="soft" />

        <div className="section-title">
          <div>
            <h2>鸽钟报时段（{draft.reports.length}）</h2>
            <p>按递增时刻校验；累计航距为里程桩，坐标用于地理位移比对；校准逐点生效</p>
          </div>
          <button onClick={addReport}>+ 增加报点</button>
        </div>

        <div className="stack">
          {draft.reports.map((r, i) => (
            <div key={r.id} className="report-edit">
              <div className="row">
                <strong className="muted">#{i + 1}</strong>
                <input
                  type="text"
                  value={r.name}
                  onChange={(e) => setReport(r.id, { name: e.target.value })}
                />
                <label className="inline muted" style={{ whiteSpace: "nowrap" }}>
                  <input
                    type="checkbox"
                    style={{ width: 16, minHeight: 0 }}
                    checked={!!r.home}
                    onChange={(e) => setReport(r.id, { home: e.target.checked })}
                  />
                  归巢点
                </label>
                <button className="danger ghost" onClick={() => removeReport(r.id)}>
                  删除
                </button>
              </div>
              <div className="form-grid">
                <label className="field">
                  鸽钟时间（原始）
                  <input
                    type="datetime-local"
                    value={r.clockTime}
                    onChange={(e) => setReport(r.id, { clockTime: e.target.value })}
                  />
                </label>
                <label className="field">
                  鸽钟校准（秒，正=读数偏早、真实时刻向后修正）
                  <input
                    type="number"
                    step="1"
                    value={r.clockOffsetSec ?? 0}
                    onChange={(e) =>
                      setReport(r.id, { clockOffsetSec: Number(e.target.value) })
                    }
                  />
                </label>
                <label className="field">
                  累计航距（km）
                  <input
                    type="number"
                    step="0.1"
                    value={r.cumKm}
                    onChange={(e) => setReport(r.id, { cumKm: Number(e.target.value) })}
                  />
                </label>
                <label className="field">
                  纬度 / 经度
                  <div className="row">
                    <input
                      type="number"
                      step="0.0001"
                      value={r.lat}
                      onChange={(e) => setReport(r.id, { lat: Number(e.target.value) })}
                    />
                    <input
                      type="number"
                      step="0.0001"
                      value={r.lng}
                      onChange={(e) => setReport(r.id, { lng: Number(e.target.value) })}
                    />
                  </div>
                </label>
              </div>
            </div>
          ))}
          {draft.reports.length === 0 && (
            <div className="empty">暂无报点，放飞后由鸽钟逐段录入</div>
          )}
        </div>

        <hr className="soft" />
        <div className="inline">
          <button className="primary" onClick={save}>
            保存并重算
          </button>
          {savedAt && <span className="muted">已保存 · 全部依赖结果已重算</span>}
        </div>
      </div>
    </div>
  );
}
