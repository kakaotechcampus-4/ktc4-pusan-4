/** 화면에 보일 계정 이름. 카카오 계정은 이메일이 없다 (api.md 1.1) */
export const accountLabel = (email: string | null) => email ?? '카카오 계정';

/** 머리말에 보일 사용자 이름. 이메일에서 @ 뒤 도메인을 뗀다 */
export const displayName = (email: string | null) => email?.split('@')[0] || '카카오 계정';
