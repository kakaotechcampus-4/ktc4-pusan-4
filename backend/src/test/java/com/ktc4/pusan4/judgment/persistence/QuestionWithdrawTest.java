package com.ktc4.pusan4.judgment.persistence;

import com.ktc4.pusan4.judgment.domain.JudgmentOrigin;
import com.ktc4.pusan4.judgment.domain.JudgmentOriginType;
import com.ktc4.pusan4.judgment.domain.QuestionSpec;
import com.ktc4.pusan4.judgment.persistence.QuestionQueueRepository.AnswerTarget;
import com.ktc4.pusan4.shared.api.ApiException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Clock;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

/** 답 취소 (api.md 3.10 답 취소). 재판정 자체는 QuestionAnswerIntegrationTest 가 실제 규칙 카드로 본다. */
class QuestionWithdrawTest {

    private static final UUID USER_ID = UUID.fromString("0199c8f2-0000-7000-8000-000000000001");
    private static final UUID BATCH_ID = UUID.fromString("0199c8f2-0000-7000-8000-000000000002");
    private static final UUID FACT_ID = UUID.fromString("0199c8f2-0000-7000-8000-000000000003");
    private static final UUID WITHDRAWAL_ID = UUID.fromString("0199c8f2-0000-7000-8000-000000000004");
    private static final String GROUP_KEY = "merchant:KT";
    private static final String FACT_TYPE = "전용여부";

    private QuestionQueueRepository questionRepository;
    private TransactionRecordRepository transactionRepository;
    private UserFactPersistenceService userFactService;
    private JudgmentExecutor executor;
    private LimitSettlementService limitSettlement;
    private QuestionAnswerService service;

    @BeforeEach
    void setUp() {
        questionRepository = mock(QuestionQueueRepository.class);
        transactionRepository = mock(TransactionRecordRepository.class);
        userFactService = mock(UserFactPersistenceService.class);
        executor = mock(JudgmentExecutor.class);
        limitSettlement = mock(LimitSettlementService.class);
        service = new QuestionAnswerService(questionRepository, transactionRepository, mock(UploadBatchRepository.class),
            userFactService, mock(QuestionQueryService.class), executor, limitSettlement,
            Clock.fixed(Instant.parse("2026-11-09T00:00:00Z"), ZoneOffset.UTC));
        given(userFactService.withdraw(any(), any(), anyString(), anyString())).willReturn(WITHDRAWAL_ID);
    }

    @Test
    void withdraw_reverts_every_answered_sibling_and_rejudges_like_an_answer() {
        // given: 같은 가맹점 질문 둘(하나만 요청)과, 질문은 없지만 그 가맹점에서 판정한 적 있는 거래
        AnswerTarget first = answered(UUID.randomUUID(), 1);
        AnswerTarget second = answered(UUID.randomUUID(), 2);
        UUID merchantOnly = UUID.randomUUID();
        given(questionRepository.findAnswerTargets(List.of(first.question().getId()), USER_ID))
            .willReturn(List.of(first));
        given(questionRepository.findSiblings(BATCH_ID, GROUP_KEY, FACT_TYPE)).willReturn(List.of(first, second));
        given(transactionRepository.findJudgedTargetIdsByMerchant(BATCH_ID, "KT")).willReturn(List.of(merchantOnly));

        // when
        QuestionWithdrawResult result = service.withdraw(USER_ID, List.of(first.question().getId()));

        // then: 두 질문이 PENDING 으로 돌아가고, 취소 version 을 origin 으로 세 거래를 최신 Context 로 재판정한다
        assertThat(result).isEqualTo(new QuestionWithdrawResult(2, 3));
        assertThat(List.of(first, second)).allSatisfy(target -> {
            assertThat(target.question().isPending()).isTrue();
            assertThat(target.question().answeredFactId()).isNull();
        });
        verify(limitSettlement).lockUser(USER_ID);
        verify(userFactService).withdraw(USER_ID, BATCH_ID, GROUP_KEY, FACT_TYPE);
        JudgmentOrigin origin = new JudgmentOrigin(JudgmentOriginType.USER_FACT, WITHDRAWAL_ID);
        verify(executor).rejudge(USER_ID, Map.of(
            first.transactionId(), origin, second.transactionId(), origin, merchantOnly, origin), 2);
    }

    @Test
    void withdraw_without_answered_questions_changes_nothing() {
        // given: 이미 답을 취소해 PENDING 인 그룹
        AnswerTarget pending = target(UUID.randomUUID(), 1);
        given(questionRepository.findAnswerTargets(List.of(pending.question().getId()), USER_ID))
            .willReturn(List.of(pending));
        given(questionRepository.findSiblings(BATCH_ID, GROUP_KEY, FACT_TYPE)).willReturn(List.of(pending));

        // when
        QuestionWithdrawResult result = service.withdraw(USER_ID, List.of(pending.question().getId()));

        // then
        assertThat(result).isEqualTo(new QuestionWithdrawResult(0, 0));
        verify(userFactService, never()).withdraw(any(), any(), anyString(), anyString());
        verify(executor, never()).rejudge(any(), anyMap(), anyInt());
    }

    @Test
    void withdraw_of_only_canceled_questions_is_a_conflict() {
        // given
        AnswerTarget canceled = target(UUID.randomUUID(), 1);
        canceledQuestion(canceled.question());
        given(questionRepository.findAnswerTargets(List.of(canceled.question().getId()), USER_ID))
            .willReturn(List.of(canceled));

        // when / then
        assertThatThrownBy(() -> service.withdraw(USER_ID, List.of(canceled.question().getId())))
            .isInstanceOfSatisfying(ApiException.class, error -> {
                assertThat(error.getStatus()).isEqualTo(HttpStatus.CONFLICT);
                assertThat(error.getCode()).isEqualTo("QUESTION_NOT_ANSWERABLE");
            });
        verify(userFactService, never()).withdraw(any(), any(), anyString(), anyString());
    }

    @Test
    void withdraw_of_missing_question_is_not_found() {
        // given
        UUID missing = UUID.randomUUID();
        given(questionRepository.findAnswerTargets(List.of(missing), USER_ID)).willReturn(List.of());

        // when / then
        assertThatThrownBy(() -> service.withdraw(USER_ID, List.of(missing)))
            .isInstanceOfSatisfying(ApiException.class,
                error -> assertThat(error.getCode()).isEqualTo("QUESTION_NOT_FOUND"));
    }

    @Test
    void withdraw_answer_only_reverts_answered_questions() {
        // given
        QuestionQueueEntity answered = question();
        answered.recordAnswer(FACT_ID, OffsetDateTime.parse("2026-11-09T09:00:00+09:00"));
        QuestionQueueEntity pending = question();

        // when / then
        assertThat(answered.withdrawAnswer()).isTrue();
        assertThat(answered.isPending()).isTrue();
        assertThat(answered.answeredFactId()).isNull();
        assertThat(pending.withdrawAnswer()).isFalse();
        assertThat(pending.isPending()).isTrue();
    }

    private AnswerTarget answered(UUID transactionId, int contextVersion) {
        AnswerTarget target = target(transactionId, contextVersion);
        target.question().recordAnswer(FACT_ID, OffsetDateTime.parse("2026-11-09T09:00:00+09:00"));
        return target;
    }

    private static AnswerTarget target(UUID transactionId, int contextVersion) {
        return new AnswerTarget(question(), transactionId, BATCH_ID, contextVersion);
    }

    private static QuestionQueueEntity question() {
        return new QuestionQueueEntity(UUID.randomUUID(), UUID.randomUUID(),
            new QuestionSpec("TELECOM_DEDICATED", "업무 전용 회선인가요?", FACT_TYPE, GROUP_KEY,
                List.of("전용", "개인"), Map.of()));
    }

    /** 재판정이 이전 revision 의 대기 질문을 취소한 상태. 엔티티는 bulk update 로만 취소되어 필드를 직접 바꾼다. */
    private static void canceledQuestion(QuestionQueueEntity question) {
        ReflectionTestUtils.setField(question, "status", "CANCELED");
    }
}
