/** docs/api.md 1.2: 시각은 ISO-8601 + KST (예: "2026-09-01T10:00:00+09:00"). */
export function nowKst(): string {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 19) + '+09:00';
}

/** docs/api.md 1.2: 날짜는 ISO-8601 (예: "2026-01-03"). */
export function todayKst(): string {
  return nowKst().slice(0, 10);
}
