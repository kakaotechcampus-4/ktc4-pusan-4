/*
 * 로그인, 가입, 비밀번호 재설정, 카카오 콜백 폼이 같이 쓰는 입력칸 모양. 화면 틀은 auth/SignInLayout 이다.
 * 예전 틀(어두운 브랜드 판)은 로그인 화면을 바꾸며 뺐다(11/11)
 */

/**
 * 로그인·가입 폼의 입력칸. 흰 바탕에 진한 테두리(edge)다. 틀린 칸은 aria-invalid 로 테두리가 빨개진다 (C91).
 * placeholder 를 흐리게(/70) 두면 흰 바탕 대비가 2.67 이라 읽히지 않는다 (C70)
 */
export const AUTH_INPUT =
'mt-1.5 w-full rounded-xl border border-edge bg-canvas px-3.5 py-2.5 text-[14px] text-ink placeholder:text-muted aria-[invalid=true]:border-deny disabled:bg-surface disabled:text-ink2';
export const AUTH_LABEL = 'block text-[13px] font-normal text-ink2';
/**
 * 로그인·가입의 버튼은 ui Button(size md, w-full)이다 (C90). 아래 둘은 아직 Button 으로 옮기지 않은
 * 카카오 콜백 화면만 쓴다. 모양은 Button md 와 같다
 */
/** 칸 바로 아래의 오류 한 줄. 칸에는 aria-describedby 로 잇는다 */
export const AUTH_FIELD_ERROR = 'mt-1.5 text-[13px] text-deny';
