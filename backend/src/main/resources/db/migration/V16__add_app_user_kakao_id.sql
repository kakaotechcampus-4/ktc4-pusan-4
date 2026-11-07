-- 카카오 계정(B9b). 카카오 회원번호로만 식별하고 이메일은 받지 않는다(동의항목에 비즈 앱 심사가 필요하다).
-- 그래서 이메일이 없는 사용자가 생긴다. 이메일 계정과 카카오 계정은 같은 이메일이어도 따로 둔다.
ALTER TABLE app_user ALTER COLUMN email DROP NOT NULL;
ALTER TABLE app_user ADD COLUMN kakao_id bigint UNIQUE;
ALTER TABLE app_user ADD CONSTRAINT app_user_login_identity CHECK (email IS NOT NULL OR kakao_id IS NOT NULL);
