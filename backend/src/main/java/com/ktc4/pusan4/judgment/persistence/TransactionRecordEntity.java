package com.ktc4.pusan4.judgment.persistence;

import com.ktc4.pusan4.judgment.domain.JudgmentRevision.JudgedTransaction;
import com.ktc4.pusan4.judgment.domain.TransactionInput;
import com.ktc4.pusan4.transaction.api.ClassificationStatus;
import com.ktc4.pusan4.transaction.api.SourceStatus;
import com.ktc4.pusan4.transaction.api.UserInclusion;
import com.ktc4.pusan4.transaction.domain.NewTransaction;
import com.ktc4.pusan4.transaction.domain.TransactionDetail;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * 카드 거래 한 건 (V8, api.md 3.3·3.4).
 *
 * <p>상태 컬럼 3개는 api.md 의 enum 이름(code)을 문자열로 담는다. 허용값은 DB CHECK 가 지킨다.
 * effectiveStatus 는 저장하지 않고 sourceStatus·userInclusion 으로 계산한다(api.md 2.3).
 *
 * <p>업로드 서비스({@code transaction.persistence})가 만들기 때문에 public 이다.
 */
@Entity
@Table(name = "transaction")
public class TransactionRecordEntity {

    @Id
    private UUID id;

    @Column(name = "batch_id", nullable = false)
    private UUID batchId;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "approved_at", nullable = false)
    private LocalDate approvedAt;

    @Column(name = "merchant_raw", nullable = false)
    private String merchantRaw;

    @Column(name = "merchant_norm", nullable = false)
    private String merchantNorm;

    @Column(name = "merchant_category", nullable = false)
    private String merchantCategory;

    @Column(nullable = false)
    private long amount;

    @Column(name = "installment_months", nullable = false)
    private int installmentMonths;

    @Column(name = "natural_key", nullable = false)
    private String naturalKey;

    /** 파서가 정한 원본 상태. JUDGEABLE / CANCELED_OFFSET / EXCLUDED. */
    @Column(name = "source_status", nullable = false)
    private String sourceStatus;

    /** 사용자의 포함·제외. AUTO / INCLUDED / EXCLUDED. */
    @Column(name = "user_inclusion", nullable = false)
    private String userInclusion;

    /** 가맹점 분류 상태. CLASSIFIED / NEEDS_REVIEW. 미분류이면 NEEDS_REVIEW 다. */
    @Column(name = "classification_status", nullable = false)
    private String classificationStatus;

    @Column(name = "approval_no")
    private String approvalNo;

    @Column(name = "biz_no")
    private String bizNo;

    private String branch;

    @Column(name = "branch_raw")
    private String branchRaw;

    private String memo;

    @Column(name = "is_aggregated", nullable = false)
    private boolean aggregated;

    @Column(name = "needs_review", nullable = false)
    private boolean needsReview;

    @Column(name = "review_reason")
    private String reviewReason;

    @Column(name = "source_card")
    private String sourceCard;

    // 응답에 바로 쓰려고 코드가 채운다(DB 기본값 now() 는 SQL 로 넣는 테스트 픽스처용으로 남는다).
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    protected TransactionRecordEntity() {
    }

    /**
     * 업로드로 받은 거래 한 건. 분류 결과(merchantNorm·merchantCategory)는 분류기가 정한 값을 그대로 받는다.
     * userInclusion 은 업로드 시점에는 항상 AUTO 다(api.md 2.3).
     */
    public TransactionRecordEntity(
        UUID id,
        UUID batchId,
        UUID userId,
        NewTransaction input,
        String merchantNorm,
        String merchantCategory,
        ClassificationStatus classificationStatus,
        OffsetDateTime createdAt
    ) {
        this.id = id;
        this.batchId = batchId;
        this.userId = userId;
        this.approvedAt = input.approvedAt();
        this.merchantRaw = input.merchantRaw();
        this.merchantNorm = merchantNorm;
        this.merchantCategory = merchantCategory;
        this.amount = input.amount();
        this.installmentMonths = input.installmentMonths();
        this.naturalKey = input.naturalKey();
        this.sourceStatus = input.status().name();
        this.userInclusion = UserInclusion.AUTO.name();
        this.classificationStatus = classificationStatus.name();
        this.approvalNo = input.approvalNo();
        this.bizNo = input.bizNo();
        this.branch = input.branch();
        this.branchRaw = input.branchRaw();
        this.memo = input.memo();
        this.aggregated = input.aggregated();
        this.needsReview = input.needsReview();
        this.reviewReason = input.reviewReason();
        this.sourceCard = input.sourceCard();
        this.createdAt = createdAt;
    }

    public UUID id() {
        return id;
    }

    public String naturalKey() {
        return naturalKey;
    }

    public String merchantNorm() {
        return merchantNorm;
    }

    public String merchantCategory() {
        return merchantCategory;
    }

    public String classificationStatus() {
        return classificationStatus;
    }

    public SourceStatus sourceStatus() {
        return SourceStatus.valueOf(sourceStatus);
    }

    /** 사용자의 포함·제외 (api.md 3.4). 판정 revision 은 만들지 않는다. 취소상계 검사는 부르는 쪽이 한다. */
    public void changeInclusion(UserInclusion inclusion) {
        this.userInclusion = inclusion.name();
    }

    public TransactionDetail toDetail() {
        return new TransactionDetail(id, batchId, approvedAt, merchantRaw, merchantNorm, merchantCategory,
            ClassificationStatus.valueOf(classificationStatus), amount, installmentMonths,
            SourceStatus.valueOf(sourceStatus), UserInclusion.valueOf(userInclusion));
    }

    public UUID userId() {
        return userId;
    }

    UUID batchId() {
        return batchId;
    }

    LocalDate approvedAt() {
        return approvedAt;
    }

    String merchantRaw() {
        return merchantRaw;
    }

    /** 지금 판정 대상인가. 조건은 TransactionRecordRepository.findRunTargetIds 와 같다(api.md 2.3, 3.6). */
    boolean judgeable() {
        return "CLASSIFIED".equals(classificationStatus)
            && (("JUDGEABLE".equals(sourceStatus) && !"EXCLUDED".equals(userInclusion))
                || ("EXCLUDED".equals(sourceStatus) && "INCLUDED".equals(userInclusion)));
    }

    JudgedTransaction toJudged() {
        return new JudgedTransaction(
            approvedAt, merchantRaw, merchantNorm, merchantCategory, amount, installmentMonths
        );
    }

    TransactionInput toInput() {
        return new TransactionInput(id, approvedAt, merchantRaw, merchantNorm, merchantCategory, amount);
    }
}
