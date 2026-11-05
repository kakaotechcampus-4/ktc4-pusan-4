/**
 * 진행 단계: 업로드 → 분류 결과 미리보기 → 판정 → 결과 (→ 되묻기 → 재판정)
 *
 * 사업자 문진은 여기 넣지 않는다. 한 번 하면 다시 하지 않는 설정이지 판정마다 밟는
 * 단계가 아니다 — 띠에 끼워 두면 카드내역을 올릴 때마다 또 해야 하는 것처럼 보인다
 * (#242 리뷰). 문진을 막는 일은 띠가 아니라 Confirm.tsx 가 한다. 고치는 길은 내 정보에 있다
 *
 * 머리띠(AppShell)와 화면마다의 「N단계」 머리글(StepEyebrow)이 이 하나를 같이 본다.
 * 전에는 화면마다 번호를 손으로 적어 둬서, 문진을 뺄 때 일곱 군데를 따로 맞춰야 했다 (#247 리뷰)
 */
export const STEPS = [
{ path: '/upload', label: '카드내역' },
{ path: '/preview', label: '분류 확인' },
// 판정 진행은 실행 id 가 주소에 있어야 한다(/run/:runId). 단계를 누르면 판정 전 확인으로 간다
{ path: '/run', to: '/confirm', label: '판정' },
{ path: '/results', label: '결과' }];


/** 단계 표시에 포함되지 않지만 특정 단계에 속하는 화면 */
export const STEP_ALIAS: Record<string, number> = {
  '/confirm': 2,
  '/questions': 3,
  '/summary': 3,
  '/judgments': 3
};

/** /upload 가 /uploads 에도 걸리지 않게 경로 조각 단위로 맞춘다 */
export const under = (pathname: string, prefix: string) =>
pathname === prefix || pathname.startsWith(`${prefix}/`);

/** 이 주소가 몇 번째 단계인가. 단계가 아니면 -1 (문진·내 정보·관리자 등) */
export function stepIndex(pathname: string): number {
  const alias = Object.entries(STEP_ALIAS).find(([prefix]) => under(pathname, prefix));
  if (alias) return alias[1];
  return STEPS.findIndex((step) => under(pathname, step.path));
}
