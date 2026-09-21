import type { PersistState } from "./types";

/**
 * 初始演示档案。包含：
 * - 全段可信到家（进入排行）
 * - 超速争议 + 双高采信（解冻进排行）
 * - 超速争议 + 单复核（保持冻结）
 * - 时刻倒挂争议 + 分歧档（保持冻结）
 * - 在飞未归
 */
export function seedState(): PersistState {
  const reviewers = [
    { id: "rv-a", name: "复核员·周正", role: "驻棚裁判" },
    { id: "rv-b", name: "复核员·林岚", role: "鸽会代表" },
  ];

  const sites = [
    {
      id: "site-xj",
      name: "新疆鄯善司放点",
      offsetMin: 6 * 60, // 放飞地 UTC+6
      totalKm: 200,
    },
    {
      id: "site-hn",
      name: "河南新乡司放点",
      offsetMin: 8 * 60, // 放飞地 UTC+8
      totalKm: 120,
    },
  ];

  const clocks = [
    { id: "clk-01", name: "电子钟 A（基准）", deltaSec: 0 },
    { id: "clk-02", name: "电子钟 B（慢 30 秒）", deltaSec: -30 },
  ];

  const rings = [
    {
      id: "ring-1",
      ringNo: "CHN-24-001839",
      bloodline: "詹森系",
      sex: "雄" as const,
      feather: "灰",
      note: "上关 120km 11 名",
    },
    {
      id: "ring-2",
      ringNo: "CHN-24-002114",
      bloodline: "凡龙系",
      sex: "雌" as const,
      feather: "雨点",
      note: "侧风耐飞",
    },
    {
      id: "ring-3",
      ringNo: "CHN-24-003056",
      bloodline: "胡本系",
      sex: "雄" as const,
      feather: "绛",
    },
    {
      id: "ring-4",
      ringNo: "CHN-23-008771",
      bloodline: "考夫曼系",
      sex: "雌" as const,
      feather: "灰白条",
      note: "种鸽转赛",
    },
  ];

  // leg-1：全段可信到家
  const leg1 = {
    id: "leg-1",
    ringId: "ring-1",
    siteId: "site-hn",
    clockId: "clk-01",
    releaseLocal: "2026-09-15T07:30:00",
    weather: "晴，西北风 2 级",
    createdAt: Date.UTC(2026, 8, 15, 0, 0),
    punches: [
      {
        id: "p-1-1",
        clockLocal: "2026-09-15T08:20:00",
        cumKm: 60,
        note: "第一感应点",
      },
      {
        id: "p-1-2",
        clockLocal: "2026-09-15T09:15:00",
        cumKm: 120,
        note: "入棚扫描",
      },
    ],
  };

  // leg-2：第二段超速争议；双高采信 → 解冻进排行
  const leg2 = {
    id: "leg-2",
    ringId: "ring-2",
    siteId: "site-xj",
    clockId: "clk-02", // 钟慢 30 秒，校正后更慢，仍超速
    releaseLocal: "2026-09-15T08:00:00",
    weather: "晴，顺风",
    createdAt: Date.UTC(2026, 8, 15, 2, 0),
    punches: [
      {
        id: "p-2-1",
        clockLocal: "2026-09-15T09:30:00",
        cumKm: 100,
      },
      {
        id: "p-2-2",
        clockLocal: "2026-09-15T09:55:00",
        cumKm: 200,
        note: "末段报点，疑似扫描延迟",
      },
    ],
  };

  // leg-3：时刻倒挂争议；仅一名复核人 → 冻结
  const leg3 = {
    id: "leg-3",
    ringId: "ring-3",
    siteId: "site-hn",
    clockId: "clk-01",
    releaseLocal: "2026-09-16T07:00:00",
    weather: "多云",
    createdAt: Date.UTC(2026, 8, 16, 0, 0),
    punches: [
      {
        id: "p-3-1",
        clockLocal: "2026-09-16T08:10:00",
        cumKm: 55,
      },
      {
        id: "p-3-2",
        clockLocal: "2026-09-16T07:58:00",
        cumKm: 120,
        note: "钟面时刻早于上一报点",
      },
    ],
  };

  // leg-4：全段可信但尚未到家（在飞）
  const leg4 = {
    id: "leg-4",
    ringId: "ring-4",
    siteId: "site-xj",
    clockId: "clk-01",
    releaseLocal: "2026-09-21T06:30:00",
    weather: "晴",
    createdAt: Date.UTC(2026, 8, 21, 0, 30),
    punches: [
      {
        id: "p-4-1",
        clockLocal: "2026-09-21T08:00:00",
        cumKm: 90,
      },
      {
        id: "p-4-2",
        clockLocal: "2026-09-21T09:40:00",
        cumKm: 150,
      },
    ],
  };

  const legs = [leg1, leg2, leg3, leg4];

  // leg-2 矛盾指纹（超速）：100km/90min=1111，100km/25min=4000（校正后 25.5min≈3922）
  const sigLeg2 = "2:overspeed@200";
  // leg-3：倒挂点同时触发 time_inversion 与 distance? 距离递增正常 → 仅 time_inversion
  const sigLeg3 = "2:time_inversion@120";

  const reviews = [
    {
      id: "rv-1",
      legId: "leg-2",
      reviewerId: "rv-a",
      confidence: "high" as const,
      reason: "核对感应点原始记录，末段为扫描设备延迟上传，航迹连续，建议采信。",
      at: Date.UTC(2026, 8, 15, 6, 10),
      issueSignature: sigLeg2,
    },
    {
      id: "rv-2",
      legId: "leg-2",
      reviewerId: "rv-b",
      confidence: "high" as const,
      reason: "调取鸽钟芯片日志，时间戳合理，顺风末段高速可解释，同意采信。",
      at: Date.UTC(2026, 8, 15, 6, 25),
      issueSignature: sigLeg2,
    },
    {
      id: "rv-3",
      legId: "leg-3",
      reviewerId: "rv-a",
      confidence: "low" as const,
      reason: "钟面时刻倒挂且无设备故障说明，报时链不可信，建议驳回。",
      at: Date.UTC(2026, 8, 16, 3, 0),
      issueSignature: sigLeg3,
    },
  ];

  return {
    version: 1,
    reviewers,
    rings,
    sites,
    clocks,
    legs,
    reviews,
    maxMpm: 1500,
    toleranceKm: 0.5,
  };
}
