import { useState } from "react";
import type { BirdProfile } from "../types";

interface Props {
  profiles: BirdProfile[];
  onChange: (profiles: BirdProfile[]) => void;
}

/** 足环档案：血统与配对记录一变，配对提示立即失效重算 */
export function ProfilePanel({ profiles, onChange }: Props) {
  const [ring, setRing] = useState("");

  const update = (ringNo: string, patch: Partial<BirdProfile>) =>
    onChange(
      profiles.map((p) => (p.ringNo === ringNo ? { ...p, ...patch } : p))
    );

  const addPair = (ringNo: string) => {
    const p = profiles.find((x) => x.ringNo === ringNo);
    if (!p) return;
    update(ringNo, {
      pairing: [
        ...p.pairing,
        { partnerRing: "", note: "" },
      ],
    });
  };

  const setPair = (ringNo: string, i: number, patch: Partial<{ partnerRing: string; note: string }>) => {
    const p = profiles.find((x) => x.ringNo === ringNo)!;
    update(ringNo, {
      pairing: p.pairing.map((x, j) => (j === i ? { ...x, ...patch } : x)),
    });
  };

  const removePair = (ringNo: string, i: number) => {
    const p = profiles.find((x) => x.ringNo === ringNo)!;
    update(ringNo, { pairing: p.pairing.filter((_, j) => j !== i) });
  };

  const addProfile = () => {
    const no = ring.trim();
    if (!no || profiles.some((p) => p.ringNo === no)) return;
    onChange([...profiles, { ringNo: no, bloodline: "", pairing: [] }]);
    setRing("");
  };

  return (
    <div className="panel">
      <div className="section-title">
        <div>
          <h2>足环档案</h2>
          <p>血统 / 配对修改即触发配对提示重算</p>
        </div>
      </div>

      <div className="inline" style={{ marginBottom: 12 }}>
        <input
          type="text"
          placeholder="新增足环号"
          value={ring}
          onChange={(e) => setRing(e.target.value)}
        />
        <button onClick={addProfile} disabled={!ring.trim()}>
          建档
        </button>
      </div>

      <div className="stack">
        {profiles.map((p) => (
          <div key={p.ringNo} className="report-edit">
            <div className="form-grid">
              <label className="field">
                足环号
                <input type="text" value={p.ringNo} disabled />
              </label>
              <label className="field">
                血统
                <input
                  type="text"
                  value={p.bloodline}
                  onChange={(e) => update(p.ringNo, { bloodline: e.target.value })}
                />
              </label>
            </div>
            <label className="field">
              备注
              <input
                type="text"
                value={p.note ?? ""}
                onChange={(e) => update(p.ringNo, { note: e.target.value })}
              />
            </label>
            <div className="stack">
              {p.pairing.map((pr, i) => (
                <div key={i} className="row" style={{ alignItems: "start" }}>
                  <input
                    type="text"
                    placeholder="配对足环号"
                    value={pr.partnerRing}
                    style={{ maxWidth: 160 }}
                    onChange={(e) => setPair(p.ringNo, i, { partnerRing: e.target.value.trim() })}
                  />
                  <input
                    type="text"
                    placeholder="配对说明"
                    value={pr.note}
                    onChange={(e) => setPair(p.ringNo, i, { note: e.target.value })}
                  />
                  <button className="danger ghost" onClick={() => removePair(p.ringNo, i)}>
                    移除
                  </button>
                </div>
              ))}
              <button onClick={() => addPair(p.ringNo)}>+ 配对记录</button>
            </div>
          </div>
        ))}
        {profiles.length === 0 && <div className="empty">暂无足环档案</div>}
      </div>
    </div>
  );
}
