// 展示用格式化

export function fmtSpeed(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${v.toFixed(0)} m/min`;
}

export function fmtMinutes(min: number): string {
  if (!Number.isFinite(min)) return "—";
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h > 0 ? `${h}h${String(m).padStart(2, "0")}m` : `${m}m`;
}

export function fmtKm(v: number): string {
  return `${v.toFixed(1)} km`;
}

export function distanceBand(km: number): "短距离" | "中距离" | "长距离" {
  if (km < 100) return "短距离";
  if (km <= 300) return "中距离";
  return "长距离";
}

export function shortIso(iso?: string): string {
  if (!iso) return "—";
  return iso.replace("T", " ").slice(0, 16);
}
