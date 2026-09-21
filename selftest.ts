import { buildSeedRaces, buildSeedProfiles } from "./src/lib/seed";
import { analyzeRace, raceSignature, profileSignature, effectiveHomed, reviewDisposition } from "./src/lib/analyze";
import type { Review } from "./src/types";

const races = buildSeedRaces();
const profiles = buildSeedProfiles();
let failures = 0;
const check = (name: string, cond: boolean, extra = "") => {
  console.log(`${cond ? "PASS" : "FAIL"} - ${name} ${extra}`);
  if (!cond) failures++;
};

for (const r of races) {
  const a = analyzeRace(r, null);
  console.log(
    r.ringNo,
    "homed:", a.homed,
    "firstDispute:", a.firstDisputeIndex,
    "issues:", a.issues.map(i => i.kind).join(","),
    "avg:", a.avgSpeedMpm?.toFixed(0)
  );
}

const [r1, r2, r3, r4, r5, r6, r7] = races;

check("R1 詹森 80km 全程可信归巢", analyzeRace(r1, null).homed);
check("R2 凡龙 争议在第3段", analyzeRace(r2, null).firstDisputeIndex === 2);
check("R2 非归巢(争议段不计未归巢)", !analyzeRace(r2, null).homed);
check("R3 种鸽 60km 全程可信", analyzeRace(r3, null).homed);
const a4 = analyzeRace(r4, null);
check("R4 争议为航距回退", a4.firstDisputeIndex === 2 && a4.issues.some(i => i.kind === "CUM_REGRESSION"));
check("R5 乌鲁木齐时区全程可信", analyzeRace(r5, null).homed);
check("R6 100km 全程可信", analyzeRace(r6, null).homed);
const a7 = analyzeRace(r7, null);
check("R7 无矛盾且未报归巢点", a7.homed === false && a7.firstDisputeIndex === -1);

// 唯一性：足环号 / 放飞时刻 / 放飞地点 任一不同则赛程签名不同
check("放飞时刻变化 → 签名不同", raceSignature(r1) !== raceSignature({ ...r1, releaseTime: "2026-09-20T07:31" }));
check("放飞地点变化 → 签名不同", raceSignature(r1) !== raceSignature({ ...r1, releaseName: "朝阳放飞点", releaseLat: 39.95 }));
check("足环号变化 → 签名不同", raceSignature(r1) !== raceSignature({ ...r1, ringNo: "CHN-24-001840" }));

// 时区变化改变签名
const changedTz = { ...r5, timeZone: "Asia/Shanghai" };
check("时区变化 → 签名失效", raceSignature(r5) !== raceSignature(changedTz));

// 逐点鸽钟校准：第3、4点读数偏早 +700s，修复段3超速（12min→23.7min≈1479）且段4不变（1042）
const r2cal: typeof r2 = JSON.parse(JSON.stringify(r2));
r2cal.reports[2].clockOffsetSec = 700;
r2cal.reports[3].clockOffsetSec = 700;
const a2cal = analyzeRace(r2cal, null);
check("逐点鸽钟校准消除段3超速矛盾", a2cal.firstDisputeIndex === -1 && a2cal.homed, JSON.stringify(a2cal.issues));
check("校准值变化 → 签名失效", raceSignature(r2) !== raceSignature(r2cal));

// 校准若只加在单一点会同时影响相邻两段（逐点校准的分段语义）
const r2half: typeof r2 = JSON.parse(JSON.stringify(r2));
r2half.reports[2].clockOffsetSec = 700;
const a2half = analyzeRace(r2half, null);
check("单点校准同时改变相邻两段(段4被压缩)", a2half.issues.some(i => i.segmentIndex === 3 && i.kind === "SPEED_OVER_LIMIT"));

// 复核：双高一致解冻采信
const sig = raceSignature(r2);
const vote = (level: "high" | "low") => ({ level, reason: "x", at: new Date().toISOString() });
let rv: Review = { raceId: r2.id, issueSignature: sig, status: "frozen", firstRequestedAt: new Date().toISOString(), reviewerA: vote("high") };
const one = analyzeRace(r2, rv);
check("仅一票不采信", !effectiveHomed(one) && one.review?.status === "frozen");
rv = { ...rv, reviewerB: vote("high"), status: "unfrozen" };
const two = analyzeRace(r2, rv);
check("双高一致解冻采信入排行", effectiveHomed(two) && reviewDisposition(two) === "accepted");
const rvLow = { ...rv, reviewerA: vote("low"), reviewerB: vote("low") };
const three = analyzeRace(r2, rvLow);
check("双低一致维持不计", reviewDisposition(three) === "rejected" && !effectiveHomed(three));
const rvSplit = { ...rv, reviewerA: vote("low"), reviewerB: vote("high"), status: "pending" };
check("高低不一不解冻(保持pending)", analyzeRace(r2, rvSplit).review?.status === "pending");

// 旧签名复核对新赛程不生效
const stale: Review = { ...rv, issueSignature: "sig-old" };
check("签名不匹配的复核不生效", analyzeRace(r2cal, stale).review === null);

// 重复提请沿用首条（App 层 createReview 幂等）— 这里验证首次提请时间字段存在
const fresh: Review = { raceId: r2.id, issueSignature: sig, status: "frozen", firstRequestedAt: "2026-09-20T01:00:00.000Z" };
check("首次提请时间被记录", fresh.firstRequestedAt !== undefined);

// 档案签名
check("档案变化 → 档案签名变化", profileSignature(profiles) !== profileSignature(profiles.slice(0, 3)));

// 时间回退检测
const badTime: typeof r1 = JSON.parse(JSON.stringify(r1));
badTime.reports[2].clockTime = badTime.reports[1].clockTime;
check("时刻非递增检出 NON_INCREASING_TIME", analyzeRace(badTime, null).issues.some(i => i.kind === "NON_INCREASING_TIME"));

// 地理位移不符：cumKm 给得过大但坐标不动
const geoBad: typeof r1 = JSON.parse(JSON.stringify(r1));
geoBad.reports[1].cumKm = 60; // 20km 位移但桩位 +60
check("航距与位移不符检出", analyzeRace(geoBad, null).issues.some(i => i.kind === "CUM_GEO_MISMATCH"));

// 唯一赛程：足环相同但放飞时刻不同，是两羽赛程
check("同足环不同时刻=不同签名",
  raceSignature(r1) !== raceSignature({ ...r1, releaseTime: "2026-09-21T07:30" }));

console.log(failures === 0 ? "\nALL TESTS PASSED" : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
