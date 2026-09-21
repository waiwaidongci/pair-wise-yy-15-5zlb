// 离线航迹可信度复测台 —— 领域类型定义

/** 足环档案 */
export interface RingRecord {
  id: string;
  ringNo: string; // 足环号，如 CHN-24-001839
  bloodline: string; // 血统
  sex: "雌" | "雄";
  feather: string; // 羽色
  note?: string;
}

/** 放飞地档案（含本地时区，用固定 UTC 偏移分钟表达，离线可用） */
export interface ReleaseSite {
  id: string;
  name: string;
  offsetMin: number; // 放飞地本地时区相对 UTC 的偏移（分钟）
  totalKm: number; // 司放全程（公里）
}

/** 鸽钟校准档案 */
export interface ClockCalibration {
  id: string;
  name: string;
  deltaSec: number; // 钟面相对标准时的偏差（秒）；正数=钟快，校正时扣除
  note?: string;
}

/** 一段鸽钟报时：钟面本地时刻 + 截至该点的累计航距 */
export interface ClockPunch {
  id: string;
  clockLocal: string; // 钟面本地时刻 yyyy-MM-ddTHH:mm:ss
  cumKm: number; // 距放飞地累计航距（公里）
  note?: string;
}

/** 一羽赛鸽的一次赛程：足环号 + 放飞时刻 + 放飞地点 唯一 */
export interface RaceLeg {
  id: string;
  ringId: string;
  siteId: string;
  clockId: string;
  releaseLocal: string; // 放飞时刻（放飞地本地钟面）yyyy-MM-ddTHH:mm:ss
  weather?: string;
  punches: ClockPunch[];
  createdAt: number;
}

export type Confidence = "high" | "mid" | "low";

/** 复核人提交的置信档 */
export interface Review {
  id: string;
  legId: string;
  reviewerId: string;
  confidence: Confidence; // high=建议采信 / mid=存疑补测 / low=建议驳回
  reason: string;
  at: number;
  issueSignature: string; // 提交时针对的矛盾点指纹
}

export interface Reviewer {
  id: string;
  name: string;
  role: string;
}

/** 旧版只读快照：判定参数档案每次变更前冻结 */
export interface VersionSnapshot {
  version: number;
  frozenAt: number;
  reason: string;
  data: PersistState;
}

/** 可持久化状态 */
export interface PersistState {
  version: number;
  reviewers: Reviewer[];
  rings: RingRecord[];
  sites: ReleaseSite[];
  clocks: ClockCalibration[];
  legs: RaceLeg[];
  reviews: Review[];
  maxMpm: number; // 分段限速（米/分）
  toleranceKm: number; // 累计航距判定容差（公里）
}
