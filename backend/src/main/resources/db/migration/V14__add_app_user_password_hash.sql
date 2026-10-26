-- 이메일 계정의 비밀번호(BCrypt). 이메일 가입 전에 있던 행과 카카오 계정은 비어 있다.
ALTER TABLE app_user ADD COLUMN password_hash varchar(100);
