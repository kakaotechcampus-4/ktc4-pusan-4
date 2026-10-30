-- 관리자 판별 (api.md 3.15). 기본은 USER 이고, 관리자는 운영 절차로 바꾼다(docs/deployment.md "관리자 지정").
-- V15·V16 은 인증 스택(#177·#176)이 쓴다. 이 마이그레이션은 그 뒤에 머지한다.
ALTER TABLE app_user
    ADD COLUMN role varchar(10) NOT NULL DEFAULT 'USER' CHECK (role IN ('USER', 'ADMIN'));
