/** 화면에 보일 계정 이름. 카카오 계정은 이메일이 없다 (api.md 1.1) */
export const accountLabel = (email: string | null) => email ?? '카카오 계정';
