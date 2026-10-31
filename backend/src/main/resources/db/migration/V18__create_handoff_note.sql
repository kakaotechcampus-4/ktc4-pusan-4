-- 세무대리인에게 물을 질문 (docs/agent-secretary.md FR-16). 비서가 제안하고 사용자가 [적용]하면 저장한다.
-- 사용자 소유라 탈퇴하면 함께 지운다. 거래 id 는 참고용이라 FK 를 걸지 않는다 — 업로드를 지워도 질문은 남긴다.
-- V15·V16(인증 스택), V17(관리자 권한)은 아직 develop 에 없는 열린 PR 들이 쓰고 있어 겹치지 않게 V18 로 둔다.
CREATE TABLE handoff_note (
    id uuid PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    text varchar(300) NOT NULL,
    transaction_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX handoff_note_user_id_idx ON handoff_note (user_id);
