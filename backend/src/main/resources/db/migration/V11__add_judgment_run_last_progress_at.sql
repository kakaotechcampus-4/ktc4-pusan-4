-- run 의 마지막 진행 시각. 만들 때, 시작할 때, 거래 한 건을 처리할 때마다 갱신한다.
-- 실행은 서버 메모리의 비동기 큐에서 돌아서, 서버가 내려가면 run 이 QUEUED·RUNNING 으로 남는다.
-- 진행이 오래 없는 run 을 정리 작업이 RUN_INTERRUPTED 로 끝낸다(JudgmentRunService.interruptStale).
-- 서버 기동 시각이 아니라 진행 시각으로 보는 건, 서버가 여러 대여도 살아 있는 run 을 끝내지 않기 위해서다.
--
-- 이전 코드 호환 (db/README.md "이전 코드와 호환되게 쓴다")
-- 이전 코드는 이 컬럼을 모르므로 DEFAULT 로 채운다. 기존 행도 now() 로 채워진다.
ALTER TABLE judgment_run
    ADD COLUMN last_progress_at timestamptz NOT NULL DEFAULT now();

-- 정리 작업이 1분마다 끝나지 않은 run 만 본다.
CREATE INDEX idx_judgment_run_unfinished_progress
    ON judgment_run(last_progress_at)
    WHERE status IN ('QUEUED', 'RUNNING');
