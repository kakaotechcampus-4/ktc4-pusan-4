-- 업로드 배치 목록·상세(api.md 3.3, docs/backend_api_plan.md B6)의 skippedDuplicateCount.
--
-- 번호: V11 은 열린 PR #128 이 쓴다. V12(#130) 와 같이 #128 이 먼저 머지되는 걸 전제한다.
--
-- 건너뛴 중복은 거래 행이 남지 않아 나중에 셀 수 없다. 업로드할 때 센 값을 batch 에 남긴다.
-- transactionCount·classificationPendingCount 는 거래·분류 검토에서 조회할 때 센다.
--
-- 이전 코드 호환 (db/README.md "이전 코드와 호환되게 쓴다")
-- 기본값 0 이 있어 이 컬럼을 모르는 이전 코드의 INSERT 가 깨지지 않는다.
-- 이미 있는 batch 는 0 이 된다. 지금까지 업로드 API 는 목 응답이라 실제 업로드로 만든 batch 가 없다.
ALTER TABLE upload_batch
    ADD COLUMN skipped_duplicate_count integer NOT NULL DEFAULT 0 CHECK (skipped_duplicate_count >= 0);
