package com.ktc4.pusan4.transaction.api;

import com.ktc4.pusan4.shared.api.Coded;
import com.ktc4.pusan4.shared.api.PageResponse;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

import static com.ktc4.pusan4.shared.api.MockFixtures.BATCH_ID;
import static com.ktc4.pusan4.shared.api.MockFixtures.TRANSACTION_ID;
import static com.ktc4.pusan4.shared.api.MockFixtures.UNCLASSIFIED_TRANSACTION_ID;
import static com.ktc4.pusan4.shared.api.MockFixtures.page;

/**
 * 서비스 레이어가 붙기 전까지 upload-batches·transactions API 가 반환하는 고정 응답.
 */
@Component
public class TransactionMockData {

    private static final OffsetDateTime UPLOADED_AT = OffsetDateTime.parse("2026-09-12T13:58:00+09:00");
    private static final Coded<SourceStatus> JUDGEABLE = new Coded<>(SourceStatus.JUDGEABLE, "판정대상");

    public UploadBatchCreatedResponse createUploadBatch() {
        return new UploadBatchCreatedResponse(BATCH_ID, 24, 0, 1, UPLOADED_AT);
    }

    public PageResponse<UploadBatchResponse> uploadBatches() {
        return page(List.of(uploadBatch()));
    }

    public UploadBatchResponse uploadBatch() {
        return new UploadBatchResponse(BATCH_ID, SourceType.승인내역, CardIssuer.국민,
            LocalDate.parse("2026-01-01"), LocalDate.parse("2026-01-31"), 24, 0, 1, UPLOADED_AT);
    }

    public PageResponse<TransactionResponse> transactions() {
        return page(List.of(transaction(), unclassifiedTransaction()));
    }

    public TransactionResponse transaction() {
        return new TransactionResponse(TRANSACTION_ID, BATCH_ID, LocalDate.parse("2026-01-12"),
            "스타벅스코리아 서면점", "스타벅스", "카페",
            new Coded<>(ClassificationStatus.CLASSIFIED, "분류 완료"), 12_800L, 0,
            JUDGEABLE, UserInclusion.AUTO, JUDGEABLE);
    }

    public TransactionInclusionResponse exclude() {
        return new TransactionInclusionResponse(TRANSACTION_ID, UserInclusion.EXCLUDED,
            new Coded<>(SourceStatus.EXCLUDED, "대상제외"));
    }

    public TransactionInclusionResponse include() {
        return new TransactionInclusionResponse(TRANSACTION_ID, UserInclusion.INCLUDED, JUDGEABLE);
    }

    private TransactionResponse unclassifiedTransaction() {
        return new TransactionResponse(UNCLASSIFIED_TRANSACTION_ID, BATCH_ID, LocalDate.parse("2026-01-31"),
            "ELEVENLABS IO", "미확인 가맹점", "미분류",
            new Coded<>(ClassificationStatus.NEEDS_REVIEW, "분류 확인 필요"), 33_000L, 0,
            JUDGEABLE, UserInclusion.AUTO, JUDGEABLE);
    }
}
