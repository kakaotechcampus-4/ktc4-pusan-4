/**
 * 로그인이 사용자 손을 거치지 않고 끝난 이유. 로그인 화면이 한 줄로 알린다 (C51·C44·C45)
 * - expired: 재발급까지 401 이다
 * - account-changed: 다른 탭에서 다른 계정으로 로그인했다. 리프레시 쿠키는 호스트마다 하나라 이 탭도 그 계정이 된다
 * - signed-out: 다른 탭에서 로그아웃했다
 */
export type SessionEndReason = 'expired' | 'account-changed' | 'signed-out';
