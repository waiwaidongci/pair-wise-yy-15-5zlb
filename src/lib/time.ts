// 纯前端时区换算：把"放飞地墙钟时间"换算为绝对时刻（epoch 毫秒）
// 不依赖任何网络服务，满足离线复测要求。

/** 指定时区在某一绝对时刻相对 UTC 的偏移（毫秒，东八区为 +480*60000） */
export function zoneOffsetMs(timeZone: string, at: Date): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(at);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  let hour = Number(get("hour"));
  if (hour === 24) hour = 0;
  const asUTC = Date.UTC(
    Number(get("year")),
    Number(get("month")) - 1,
    Number(get("day")),
    hour,
    Number(get("minute")),
    Number(get("second"))
  );
  return asUTC - at.getTime();
}

/**
 * 墙钟时间（YYYY-MM-DDTHH:mm，按 timeZone 解释）→ epoch。
 * 两次逼近以消除 DST 边界附近的自洽误差。
 */
export function wallToEpoch(wall: string, timeZone: string): number {
  const utcGuess = Date.parse(wall.length === 16 ? wall + ":00Z" : wall + "Z");
  if (Number.isNaN(utcGuess)) return NaN;
  const off1 = zoneOffsetMs(timeZone, new Date(utcGuess));
  const epoch = utcGuess - off1;
  const off2 = zoneOffsetMs(timeZone, new Date(epoch));
  return utcGuess - off2;
}

/** epoch → 指定时区墙钟字符串 YYYY-MM-DD HH:mm */
export function epochToWall(epoch: number, timeZone: string): string {
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const parts = dtf.formatToParts(new Date(epoch));
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  let hour = get("hour");
  if (hour === "24") hour = "00";
  return `${get("year")}-${get("month")}-${get("day")} ${hour}:${get("minute")}`;
}

/** 分钟差（校准后报时时刻之间） */
export function minutesBetween(aEpoch: number, bEpoch: number): number {
  return (bEpoch - aEpoch) / 60000;
}

/** 当前时间 ISO（落库用） */
export function nowIso(): string {
  return new Date().toISOString();
}
