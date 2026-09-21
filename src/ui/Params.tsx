import { useState } from "react";
import { useStore, uid } from "../store/store";
import type {
  ClockCalibration,
  PersistState,
  ReleaseSite,
  RingRecord,
  Reviewer,
} from "../domain/types";
import { Field, useToast } from "./widgets";

/**
 * 判定参数档案：放飞地时区、鸽钟校准、足环档案、限速/容差、复核人。
 * 任一项保存时：先冻结旧版（只读快照），版本号 +1，排行/风险/配对失效重算。
 */
export function Params() {
  const { state, applyParamChange } = useStore();
  const toast = useToast();
  const [draft, setDraft] = useState<PersistState>(() =>
    JSON.parse(JSON.stringify(state))
  );
  const dirty = JSON.stringify(draft) !== JSON.stringify(state);

  function commit(reason: string) {
    applyParamChange(draft, reason, { freeze: true });
    toast(`旧版 v${state.version} 已只读冻结，新版排行/风险/配对已重算`, "ok");
  }

  function resetDraft() {
    setDraft(JSON.parse(JSON.stringify(state)));
  }

  return (
    <div className="params-layout">
      {dirty && (
        <div className="dirty-bar">
          <b>参数档案有未发布修改</b>
          <span>发布保存将冻结当前 v{state.version} 旧版并重算全部结论</span>
          <div>
            <button onClick={resetDraft}>放弃修改</button>
            <button className="primary" onClick={() => commit("判定参数档案手动发布")}>
              发布并冻结旧版
            </button>
          </div>
        </div>
      )}

      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="panel-kicker">全局判定参数</p>
            <h2>分段限速与航距容差</h2>
          </div>
        </div>
        <div className="form-grid">
          <Field label="分段限速（米/分）" hint="超过即判矛盾">
            <input
              type="number"
              min={1}
              value={draft.maxMpm}
              onChange={(e) =>
                setDraft({ ...draft, maxMpm: +e.target.value })
              }
            />
          </Field>
          <Field label="累计航距容差（公里）" hint="到家/超程判定缓冲">
            <input
              type="number"
              step="0.1"
              min={0}
              value={draft.toleranceKm}
              onChange={(e) =>
                setDraft({ ...draft, toleranceKm: +e.target.value })
              }
            />
          </Field>
        </div>
      </section>

      <SitesEditor draft={draft} setDraft={setDraft} />
      <ClocksEditor draft={draft} setDraft={setDraft} />
      <RingsEditor draft={draft} setDraft={setDraft} />
      <ReviewersEditor
        draft={draft}
        setDraft={setDraft}
        onCommit={commit}
      />

      <section className="panel">
        <p className="form-note">
          说明：放飞地时区（UTC 固定偏移）、鸽钟校准偏差、足环档案与限速容差均属于
          <b>判定参数</b>。它们一变化，所有赛程的校正时刻、分段速度、矛盾点指纹、
          排行、风险等级与配对提示全部失效重算，复核意见按新的矛盾指纹重新比对；
          发布前的完整档案自动冻结为只读旧版。赛程与报时数据的日常增删不产生版本快照。
        </p>
        {!dirty && <p className="dim">当前档案与已发布版本 v{state.version} 一致。</p>}
      </section>
    </div>
  );
}

/* ---------------- 放飞地 ---------------- */

function SitesEditor({
  draft,
  setDraft,
}: {
  draft: PersistState;
  setDraft: (s: PersistState) => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState({ name: "", offsetMin: 8 * 60, totalKm: 100 });

  function add() {
    if (!form.name.trim()) return toast("请填写放飞地名称", "err");
    const site: ReleaseSite = { id: uid("site"), ...form };
    setDraft({ ...draft, sites: [...draft.sites, site] });
    setForm({ name: "", offsetMin: 8 * 60, totalKm: 100 });
    toast("放飞地已加入草稿，发布后生效", "info");
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <p className="panel-kicker">时区一改，全部校正时刻与分段速度重算</p>
          <h2>放飞地档案（本地时区 / 全程）</h2>
        </div>
      </div>
      <table className="data-table">
        <thead>
          <tr>
            <th>名称</th>
            <th>时区偏移（分钟）</th>
            <th>UTC</th>
            <th>司放全程(km)</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {draft.sites.map((s) => (
            <tr key={s.id}>
              <td>
                <input
                  value={s.name}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      sites: draft.sites.map((x) =>
                        x.id === s.id ? { ...x, name: e.target.value } : x
                      ),
                    })
                  }
                />
              </td>
              <td>
                <input
                  type="number"
                  step={15}
                  value={s.offsetMin}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      sites: draft.sites.map((x) =>
                        x.id === s.id
                          ? { ...x, offsetMin: +e.target.value }
                          : x
                      ),
                    })
                  }
                />
              </td>
              <td className="dim">UTC{s.offsetMin / 60}</td>
              <td>
                <input
                  type="number"
                  value={s.totalKm}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      sites: draft.sites.map((x) =>
                        x.id === s.id ? { ...x, totalKm: +e.target.value } : x
                      ),
                    })
                  }
                />
              </td>
              <td>
                <button
                  className="icon-btn"
                  onClick={() =>
                    setDraft({
                      ...draft,
                      sites: draft.sites.filter((x) => x.id !== s.id),
                    })
                  }
                >
                  删除
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="inline-add">
        <input
          placeholder="新放飞地名称"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <input
          type="number"
          step={15}
          title="UTC 偏移分钟，如 360=UTC+6"
          value={form.offsetMin}
          onChange={(e) => setForm({ ...form, offsetMin: +e.target.value })}
        />
        <input
          type="number"
          placeholder="全程 km"
          value={form.totalKm}
          onChange={(e) => setForm({ ...form, totalKm: +e.target.value })}
        />
        <button onClick={add}>＋ 放飞地</button>
      </div>
    </section>
  );
}

/* ---------------- 鸽钟校准 ---------------- */

function ClocksEditor({
  draft,
  setDraft,
}: {
  draft: PersistState;
  setDraft: (s: PersistState) => void;
}) {
  const [form, setForm] = useState({ name: "", deltaSec: 0, note: "" });
  const toast = useToast();

  function add() {
    if (!form.name.trim()) return toast("请填写鸽钟名称", "err");
    const c: ClockCalibration = { id: uid("clk"), ...form };
    setDraft({ ...draft, clocks: [...draft.clocks, c] });
    setForm({ name: "", deltaSec: 0, note: "" });
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <p className="panel-kicker">校准偏差一变，钟面校正时刻整体平移并重算</p>
          <h2>鸽钟校准档案</h2>
        </div>
      </div>
      <table className="data-table">
        <thead>
          <tr>
            <th>鸽钟名称</th>
            <th>偏差(秒，正=钟快)</th>
            <th>备注</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {draft.clocks.map((c) => (
            <tr key={c.id}>
              <td>
                <input
                  value={c.name}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      clocks: draft.clocks.map((x) =>
                        x.id === c.id ? { ...x, name: e.target.value } : x
                      ),
                    })
                  }
                />
              </td>
              <td>
                <input
                  type="number"
                  value={c.deltaSec}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      clocks: draft.clocks.map((x) =>
                        x.id === c.id ? { ...x, deltaSec: +e.target.value } : x
                      ),
                    })
                  }
                />
              </td>
              <td>
                <input
                  value={c.note ?? ""}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      clocks: draft.clocks.map((x) =>
                        x.id === c.id ? { ...x, note: e.target.value } : x
                      ),
                    })
                  }
                />
              </td>
              <td>
                <button
                  className="icon-btn"
                  onClick={() =>
                    setDraft({
                      ...draft,
                      clocks: draft.clocks.filter((x) => x.id !== c.id),
                    })
                  }
                >
                  删除
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="inline-add">
        <input
          placeholder="新鸽钟名称"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <input
          type="number"
          placeholder="偏差秒"
          value={form.deltaSec}
          onChange={(e) => setForm({ ...form, deltaSec: +e.target.value })}
        />
        <input
          placeholder="备注"
          value={form.note}
          onChange={(e) => setForm({ ...form, note: e.target.value })}
        />
        <button onClick={add}>＋ 鸽钟</button>
      </div>
    </section>
  );
}

/* ---------------- 足环档案 ---------------- */

function RingsEditor({
  draft,
  setDraft,
}: {
  draft: PersistState;
  setDraft: (s: PersistState) => void;
}) {
  const [form, setForm] = useState<Omit<RingRecord, "id">>({
    ringNo: "",
    bloodline: "",
    sex: "雄",
    feather: "",
    note: "",
  });
  const toast = useToast();

  function add() {
    if (!form.ringNo.trim()) return toast("请填写足环号", "err");
    const r: RingRecord = { id: uid("ring"), ...form };
    setDraft({ ...draft, rings: [...draft.rings, r] });
    setForm({ ringNo: "", bloodline: "", sex: "雄", feather: "", note: "" });
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <p className="panel-kicker">足环档案变更将改变赛程归属、配对与历史成绩</p>
          <h2>足环档案</h2>
        </div>
      </div>
      <table className="data-table">
        <thead>
          <tr>
            <th>足环号</th>
            <th>血统</th>
            <th>性别</th>
            <th>羽色</th>
            <th>备注</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {draft.rings.map((r) => (
            <tr key={r.id}>
              <td>
                <input
                  value={r.ringNo}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      rings: draft.rings.map((x) =>
                        x.id === r.id ? { ...x, ringNo: e.target.value } : x
                      ),
                    })
                  }
                />
              </td>
              <td>
                <input
                  value={r.bloodline}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      rings: draft.rings.map((x) =>
                        x.id === r.id ? { ...x, bloodline: e.target.value } : x
                      ),
                    })
                  }
                />
              </td>
              <td>
                <select
                  value={r.sex}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      rings: draft.rings.map((x) =>
                        x.id === r.id
                          ? { ...x, sex: e.target.value as "雌" | "雄" }
                          : x
                      ),
                    })
                  }
                >
                  <option value="雄">雄</option>
                  <option value="雌">雌</option>
                </select>
              </td>
              <td>
                <input
                  value={r.feather}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      rings: draft.rings.map((x) =>
                        x.id === r.id ? { ...x, feather: e.target.value } : x
                      ),
                    })
                  }
                />
              </td>
              <td>
                <input
                  value={r.note ?? ""}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      rings: draft.rings.map((x) =>
                        x.id === r.id ? { ...x, note: e.target.value } : x
                      ),
                    })
                  }
                />
              </td>
              <td>
                <button
                  className="icon-btn"
                  onClick={() =>
                    setDraft({
                      ...draft,
                      rings: draft.rings.filter((x) => x.id !== r.id),
                    })
                  }
                >
                  删除
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="inline-add">
        <input
          placeholder="足环号"
          value={form.ringNo}
          onChange={(e) => setForm({ ...form, ringNo: e.target.value })}
        />
        <input
          placeholder="血统"
          value={form.bloodline}
          onChange={(e) => setForm({ ...form, bloodline: e.target.value })}
        />
        <select
          value={form.sex}
          onChange={(e) =>
            setForm({ ...form, sex: e.target.value as "雌" | "雄" })
          }
        >
          <option value="雄">雄</option>
          <option value="雌">雌</option>
        </select>
        <input
          placeholder="羽色"
          value={form.feather}
          onChange={(e) => setForm({ ...form, feather: e.target.value })}
        />
        <button onClick={add}>＋ 足环</button>
      </div>
    </section>
  );
}

/* ---------------- 复核人（固定两名） ---------------- */

function ReviewersEditor({
  draft,
  setDraft,
  onCommit,
}: {
  draft: PersistState;
  setDraft: (s: PersistState) => void;
  onCommit: (reason: string) => void;
}) {
  function ensureTwo() {
    const next = [...draft.reviewers];
    if (next.length < 2) {
      while (next.length < 2)
        next.push({
          id: uid("rv"),
          name: `复核人 ${next.length + 1}`,
          role: "待指派",
        });
      setDraft({ ...draft, reviewers: next });
    }
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <p className="panel-kicker">固定两名复核人，各自独立提交，同档一致才解冻</p>
          <h2>复核人设置</h2>
        </div>
      </div>
      <div className="reviewer-grid">
        {draft.reviewers.map((rv: Reviewer, i) => (
          <div key={rv.id} className="reviewer-card">
            <small>复核人 {i + 1}</small>
            <input
              value={rv.name}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  reviewers: draft.reviewers.map((x) =>
                    x.id === rv.id ? { ...x, name: e.target.value } : x
                  ),
                })
              }
            />
            <input
              value={rv.role}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  reviewers: draft.reviewers.map((x) =>
                    x.id === rv.id ? { ...x, role: e.target.value } : x
                  ),
                })
              }
            />
          </div>
        ))}
        {draft.reviewers.length < 2 && (
          <button onClick={ensureTwo}>补齐为两名复核人</button>
        )}
      </div>
      <p className="form-note">
        复核人变更会改变争议队列的提交归属；历史复核记录保留。发布后旧版冻结。
      </p>
      <div className="modal-actions">
        <button className="primary" onClick={() => onCommit("复核人设置变更")}>
          立即发布复核人变更
        </button>
      </div>
    </section>
  );
}
