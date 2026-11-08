/**
 * 로그인해 있다는 표시. 세션은 쿠키라 페이지가 뜨기 전에는 알 수 없어서, 홈 인트로를 띄울지
 * 이것으로 먼저 정한다(Landing, index.html 의 덮개 스크립트). 바꾸면 index.html 도 바꾼다
 */
const SIGNED_IN_HINT = 'preet.signedIn';

export function signedInHint() {
  try {
    return window.localStorage.getItem(SIGNED_IN_HINT) !== null;
  } catch {
    return false;
  }
}

export function setSignedInHint(on: boolean) {
  try {
    if (on) window.localStorage.setItem(SIGNED_IN_HINT, '1');else
    window.localStorage.removeItem(SIGNED_IN_HINT);
  } catch {
    // 저장소를 막아 둔 브라우저. 인트로가 로그인한 사람에게도 뜰 뿐이다
  }
}
