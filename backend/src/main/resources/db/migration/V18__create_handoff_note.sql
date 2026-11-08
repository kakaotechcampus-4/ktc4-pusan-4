-- 세무대리인에게 물을 질문 (docs/agent-secretary.md FR-16). 비서가 제안하고 사용자가 [적용]하면 저장한다.
-- 사용자 소유라 탈퇴하면 함께 지운다. 업로드를 지워도 질문은 남기고 그 거래와의 연결만 지운다.
-- V15·V16(인증 스택), V17(관리자 권한)은 아직 develop 에 없는 열린 PR 들이 쓰고 있어 겹치지 않게 V18 로 둔다.
CREATE TABLE handoff_note (
    id uuid PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    text varchar(300) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX handoff_note_user_id_idx ON handoff_note (user_id);

-- 질문에 붙인 거래. 거래 id 를 jsonb 배열로 두면 지운 거래를 가리키는 id 가 남고, 남의 거래 id 도 DB 가 막지 못한다.
CREATE TABLE handoff_note_transaction (
    handoff_note_id uuid NOT NULL REFERENCES handoff_note(id) ON DELETE CASCADE,
    transaction_id uuid NOT NULL REFERENCES transaction(id) ON DELETE CASCADE,
    PRIMARY KEY (handoff_note_id, transaction_id)
);

-- 거래 삭제(batch 삭제) CASCADE 가 이 칸으로 찾는다 (V9).
CREATE INDEX handoff_note_transaction_transaction_id_idx ON handoff_note_transaction (transaction_id);
