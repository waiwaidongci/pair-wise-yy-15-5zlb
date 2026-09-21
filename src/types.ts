// 离线航迹可信度复测台 · 领域模型

export type ConfidenceLevel = "high" | "low";

/** 鸽钟报时段 */
export interface ClockReport {
  id: string;
  /** 报点名称（如：第一计时点 / 鸽钟打卡） */
  name: string;
  /** 经纬度 */
  lat: number;
  lng: number;
  /** 原始鸽钟时间（YYYY-MM-DDTHH:mm，不带时区，按放飞地时区解释） */
  clockTime: string;
  /** 该点累计航距（公里，沿赛程的里程桩），放飞点为 0 */
  cumKm: number;
  /** 是否为归巢巢门点 */
  home?: boolean;
  /** 该报点鸽钟校准（秒，正=该点鸽钟拨快）；放飞点为官方时刻不校准 */
  clockOffsetSec?: number;
}

/** 一段赛程：足环号 × 放飞时刻 × 放飞地点 唯一 */
export interface Race {
  id: string;
  ringNo: string;
  bloodline: string;
  releaseName: string;
  releaseLat: number;
  releaseLng: number;
  /** 放飞地 IANA 时区，如 Asia/Shanghai / Asia/Urumqi */
  timeZone: string;
  /** 放飞时刻（墙钟时间 YYYY-MM-DDTHH:mm） */
  releaseTime: string;
  /** 分段限速（米/分钟），段速超过即判矛盾 */
  speedLimitMpm: number;
  reports: ClockReport[];
}

/** 配对提示 */
export interface PairingHint {
  partnerRing: string;
  note: string;
}

/** 足环档案 */
export interface BirdProfile {
  ringNo: string;
  bloodline: string;
  pairing: PairingHint[];
  note?: string;
}

/** 单段校验结果 */
export interface SegmentResult {
  fromId: string;
  toId: string;
  fromName: string;
  toName: string;
  /** 分段耗时（分钟，已按校准换算） */
  minutes: number;
  /** 分段地理位移（公里，haversine） */
  geoKm: number;
  /** 分段里程差（累计航距差，可能为负即回退） */
  cumDeltaKm: number;
  /** 分段速度（米/分钟，按累计航距 / 时间） */
  speedMpm: number;
  issues: IssueKind[];
  trusted: boolean;
}

export type IssueKind =
  | "NON_INCREASING_TIME"
  | "SPEED_OVER_LIMIT"
  | "CUM_REGRESSION"
  | "CUM_GEO_MISMATCH";

export interface Issue {
  segmentIndex: number;
  fromId: string;
  toId: string;
  kind: IssueKind;
  detail: string;
}

export type FreezeStatus = "frozen" | "pending" | "unfrozen";

/** 单个复核人的意见档 */
export interface ReviewVote {
  level: ConfidenceLevel;
  reason: string;
  at: string; // 提交时间 ISO
}

/** 复核记录：两名复核人各一票 */
export interface Review {
  raceId: string;
  /** 争议点签名，参数变更后签名失效 */
  issueSignature: string;
  reviewerA?: ReviewVote;
  reviewerB?: ReviewVote;
  status: FreezeStatus;
  /** 重复提请沿用首条时的首次提请时间 */
  firstRequestedAt?: string;
  lastResultAt?: string;
}

/** 赛程派生分析结果 */
export interface RaceAnalysis {
  race: Race;
  segments: SegmentResult[];
  /** 连续可信前缀长度（段数） */
  trustedRunLength: number;
  /** 首个争议段下标（segments 下标），无则 -1 */
  firstDisputeIndex: number;
  issues: Issue[];
  /** 可信前缀是否一路抵达最后一个报点 */
  homed: boolean;
  /** 可信前缀末点 */
  trustedEndReportId: string | null;
  /** 可信前缀累计航距 / 总航距 */
  trustedKm: number;
  totalKm: number;
  /** 可信前缀均速 */
  avgSpeedMpm: number | null;
  /** 放飞->首个可信段终点总用时 */
  trustedMinutes: number;
  /** 计算所依据的参数签名 */
  signature: string;
  review: Review | null;
}
