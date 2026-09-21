// 地理距离（haversine，WGS84 椭球近似）

const EARTH_R = 6371.0088;

const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_R * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** 沿大圆方向行进 distKm 后的坐标（用于生成示例计时点） */
export function destination(
  lat: number,
  lng: number,
  bearingDeg: number,
  distKm: number
): [number, number] {
  const d = distKm / EARTH_R;
  const br = toRad(bearingDeg);
  const φ1 = toRad(lat);
  const λ1 = toRad(lng);
  const φ2 = Math.asin(
    Math.sin(φ1) * Math.cos(d) + Math.cos(φ1) * Math.sin(d) * Math.cos(br)
  );
  const λ2 =
    λ1 +
    Math.atan2(
      Math.sin(br) * Math.sin(d) * Math.cos(φ1),
      Math.cos(d) - Math.sin(φ1) * Math.sin(φ2)
    );
  return [toDeg(φ2), toDeg(λ2)];
}
