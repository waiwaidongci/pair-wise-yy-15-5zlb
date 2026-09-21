import type { BirdProfile, ClockReport, Race } from "../types";
import { destination } from "./geo";

interface Waypoint {
  name: string;
  km: number;
  time: string;
}

function route(
  startLat: number,
  startLng: number,
  bearing: number,
  points: Waypoint[],
  prefix: string
): ClockReport[] {
  return points.map((p, i) => {
    const [lat, lng] = destination(startLat, startLng, bearing, p.km);
    return {
      id: `${prefix}-p${i + 1}`,
      name: p.name,
      lat: Number(lat.toFixed(5)),
      lng: Number(lng.toFixed(5)),
      clockTime: p.time,
      cumKm: p.km,
      home: p.name.includes("归巢"),
    };
  });
}

const BJ: [number, number] = [39.9042, 116.4074];
const URUMQI: [number, number] = [43.8256, 87.6168];

export function buildSeedRaces(): Race[] {
  return [
    {
      id: "race-1839",
      ringNo: "CHN-24-001839",
      bloodline: "詹森系",
      releaseName: "顺义放飞点",
      releaseLat: BJ[0],
      releaseLng: BJ[1],
      timeZone: "Asia/Shanghai",
      releaseTime: "2026-09-20T07:30",
      speedLimitMpm: 1500,
      reports: route(BJ[0], BJ[1], 45, [
        { name: "20km 计时点", km: 20, time: "2026-09-20T07:46" },
        { name: "40km 计时点", km: 40, time: "2026-09-20T08:02" },
        { name: "60km 计时点", km: 60, time: "2026-09-20T08:18" },
        { name: "80km 归巢巢门", km: 80, time: "2026-09-20T08:34" },
      ], "r1"),
    },
    {
      id: "race-2114",
      ringNo: "CHN-24-002114",
      bloodline: "凡龙系",
      releaseName: "蓟州放飞点",
      releaseLat: BJ[0],
      releaseLng: BJ[1],
      timeZone: "Asia/Shanghai",
      releaseTime: "2026-09-20T07:20",
      speedLimitMpm: 1500,
      // 前两段正常，第三段 35km / 12min ≈ 2917 m/min，超速争议
      reports: route(BJ[0], BJ[1], 45, [
        { name: "30km 计时点", km: 30, time: "2026-09-20T07:47" },
        { name: "60km 计时点", km: 60, time: "2026-09-20T08:14" },
        { name: "95km 计时点", km: 95, time: "2026-09-20T08:26" },
        { name: "120km 归巢巢门", km: 120, time: "2026-09-20T08:50" },
      ], "r2"),
    },
    {
      id: "race-8771",
      ringNo: "CHN-23-008771",
      bloodline: "种鸽",
      releaseName: "房山放飞点",
      releaseLat: BJ[0],
      releaseLng: BJ[1],
      timeZone: "Asia/Shanghai",
      releaseTime: "2026-09-20T08:00",
      speedLimitMpm: 1300,
      reports: route(BJ[0], BJ[1], 200, [
        { name: "30km 计时点", km: 30, time: "2026-09-20T08:30" },
        { name: "60km 归巢巢门", km: 60, time: "2026-09-20T09:00" },
      ], "r3"),
    },
    {
      id: "race-0455",
      ringNo: "CHN-25-010455",
      bloodline: "狄尔巴系",
      releaseName: "保定放飞点",
      releaseLat: BJ[0],
      releaseLng: BJ[1],
      timeZone: "Asia/Shanghai",
      releaseTime: "2026-09-20T07:00",
      speedLimitMpm: 1400,
      // 第三点坐标仍向前飞，但桩位航距 100→96 回退，构成争议
      reports: (() => {
        const base = route(BJ[0], BJ[1], 45, [
          { name: "50km 计时点", km: 50, time: "2026-09-20T07:48" },
          { name: "100km 计时点", km: 100, time: "2026-09-20T08:36" },
          { name: "150km 计时点", km: 150, time: "2026-09-20T09:24" },
          { name: "200km 归巢巢门", km: 200, time: "2026-09-20T10:12" },
        ], "r4");
        base[2] = { ...base[2], cumKm: 96 };
        base[3] = { ...base[3], cumKm: 196 };
        return base;
      })(),
    },
    {
      id: "race-0712",
      ringNo: "CHN-22-030712",
      bloodline: "吴淞系",
      releaseName: "乌鲁木齐放飞点",
      releaseLat: URUMQI[0],
      releaseLng: URUMQI[1],
      timeZone: "Asia/Urumqi",
      releaseTime: "2026-09-20T09:00",
      speedLimitMpm: 1400,
      reports: route(URUMQI[0], URUMQI[1], 30, [
        { name: "50km 计时点", km: 50, time: "2026-09-20T09:44" },
        { name: "100km 计时点", km: 100, time: "2026-09-20T10:27" },
        { name: "150km 归巢巢门", km: 150, time: "2026-09-20T11:11" },
      ], "r5"),
    },
    {
      id: "race-0992",
      ringNo: "CHN-25-010992",
      bloodline: "胡本系",
      releaseName: "廊坊放飞点",
      releaseLat: BJ[0],
      releaseLng: BJ[1],
      timeZone: "Asia/Shanghai",
      releaseTime: "2026-09-20T07:15",
      speedLimitMpm: 1500,
      reports: route(BJ[0], BJ[1], 45, [
        { name: "50km 计时点", km: 50, time: "2026-09-20T07:54" },
        { name: "100km 归巢巢门", km: 100, time: "2026-09-20T08:33" },
      ], "r6"),
    },
    {
      id: "race-1234",
      ringNo: "CHN-25-011234",
      bloodline: "李鸟系",
      releaseName: "通州放飞点",
      releaseLat: BJ[0],
      releaseLng: BJ[1],
      timeZone: "Asia/Shanghai",
      releaseTime: "2026-09-20T07:40",
      speedLimitMpm: 1400,
      // 仅一个中途报点且无矛盾：尚在飞行，归巢未确认，不计争议
      reports: route(BJ[0], BJ[1], 45, [
        { name: "25km 中途计时点", km: 25, time: "2026-09-20T08:00" },
      ], "r7"),
    },
  ];
}

export function buildSeedProfiles(): BirdProfile[] {
  return [
    {
      ringNo: "CHN-24-001839",
      bloodline: "詹森系",
      pairing: [
        { partnerRing: "CHN-23-008771", note: "短距冲线 × 稳定种母，拟配春育" },
      ],
    },
    {
      ringNo: "CHN-24-002114",
      bloodline: "凡龙系",
      pairing: [
        { partnerRing: "CHN-25-010455", note: "争议航迹未解冻，配对暂缓" },
      ],
    },
    {
      ringNo: "CHN-23-008771",
      bloodline: "种鸽",
      pairing: [
        { partnerRing: "CHN-24-001839", note: "回血保种，待春赛复测" },
      ],
    },
    {
      ringNo: "CHN-25-010455",
      bloodline: "狄尔巴系",
      pairing: [],
      note: "长距候选，150km 点桩位回退待核",
    },
    {
      ringNo: "CHN-22-030712",
      bloodline: "吴淞系",
      pairing: [],
    },
    {
      ringNo: "CHN-25-010992",
      bloodline: "胡本系",
      pairing: [],
    },
    {
      ringNo: "CHN-25-011234",
      bloodline: "李鸟系",
      pairing: [],
      note: "秋训首站，归巢待报",
    },
  ];
}

export const TZ_OPTIONS = [
  "Asia/Shanghai",
  "Asia/Urumqi",
  "Asia/Kashgar",
  "Asia/Tokyo",
  "UTC",
];
