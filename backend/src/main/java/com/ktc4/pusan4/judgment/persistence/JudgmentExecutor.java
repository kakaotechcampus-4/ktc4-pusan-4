package com.ktc4.pusan4.judgment.persistence;

import com.ktc4.pusan4.holiday.HolidayCalendar;
import com.ktc4.pusan4.judgment.domain.Judgment;
import com.ktc4.pusan4.judgment.domain.JudgmentEngine;
import com.ktc4.pusan4.judgment.domain.JudgmentOrigin;
import com.ktc4.pusan4.judgment.domain.RuleSet;
import com.ktc4.pusan4.judgment.domain.UserContext;
import com.ktc4.pusan4.judgment.domain.UserFact;
import com.ktc4.pusan4.user.domain.BusinessContext;
import com.ktc4.pusan4.user.persistence.BusinessContextService;
import jakarta.persistence.NoResultException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * 거래 한 건을 판정해 새 revision 으로 저장한다 (api.md 0.2).
 * 엔진 judge() 는 순수 함수로 두고, 입력(거래, Context, batch UserFact, 공휴일)을 모으고 결과를 저장하는 일을 여기서 한다.
 * 어떤 거래를 판정할지(판정 대상·분류 완료 여부)는 호출하는 쪽이 정한다.
 */
@Service
public class JudgmentExecutor {

    private final RuleSet ruleSet;
    private final String rulesCommitSha;
    private final HolidayCalendar holidayCalendar;
    private final TransactionRecordRepository transactionRepository;
    private final UserFactPersistenceService userFactService;
    private final JudgmentService judgmentService;
    private final QuestionQueueRepository questionRepository;
    private final BusinessContextService contextService;

    public JudgmentExecutor(
        RuleSet ruleSet,
        @Value("${app.rules.commit-sha}") String rulesCommitSha,
        HolidayCalendar holidayCalendar,
        TransactionRecordRepository transactionRepository,
        UserFactPersistenceService userFactService,
        JudgmentService judgmentService,
        QuestionQueueRepository questionRepository,
        BusinessContextService contextService
    ) {
        this.ruleSet = ruleSet;
        this.rulesCommitSha = rulesCommitSha;
        this.holidayCalendar = holidayCalendar;
        this.transactionRepository = transactionRepository;
        this.userFactService = userFactService;
        this.judgmentService = judgmentService;
        this.questionRepository = questionRepository;
        this.contextService = contextService;
    }

    /**
     * @param context 판정에 쓸 문진 버전. 버전은 revision 에 남는다(user_context_version).
     * @param origin  이 revision 을 만든 직접 원인 (api.md 4)
     */
    @Transactional
    public UUID judge(UUID transactionId, BusinessContext context, JudgmentOrigin origin) {
        TransactionRecordEntity transaction = transactionRepository.findById(transactionId)
            .orElseThrow(NoResultException::new);
        if (!transaction.userId().equals(context.userId())) {
            throw new IllegalArgumentException("Context belongs to another user: " + context.id());
        }
        List<UserFact> facts = userFactService.findAllLatest(transaction.userId(), transaction.batchId());
        Judgment judgment = JudgmentEngine.judge(
            transaction.toInput(),
            new UserContext(context.industryCode(), context.hasEmployee(), context.homeOfficeRatio()),
            facts,
            ruleSet,
            holidayCalendar.publicHolidays()
        );

        LocalDate approvedAt = transaction.approvedAt();
        UUID judgmentId = judgmentService.save(new SaveJudgmentCommand(
            transactionId, origin, rulesCommitSha, context.version(),
            approvedAt.getYear(), approvedAt,
            transaction.merchantCategory(), transaction.merchantRaw(), context.industryCode(),
            facts, judgment
        ));
        questionRepository.cancelPendingOfOtherRevisions(transactionId, judgmentId);
        return judgmentId;
    }

    /**
     * 여러 거래를 같은 문진 버전으로 다시 판정한다. 분류 응답(B8)과 질문 응답(A4b)이 부른다.
     * Context 버전은 호출하는 쪽이 api.md 규칙(최근 run 의 버전, 질문이 생긴 판정의 버전)으로 정해 넘긴다.
     * 호출한 쪽 트랜잭션에 묶여, 한 건이라도 실패하면 응답 전체가 롤백된다.
     */
    @Transactional
    public void rejudge(UUID userId, List<UUID> transactionIds, JudgmentOrigin origin, int contextVersion) {
        BusinessContext context = contextService.version(userId, contextVersion);
        transactionIds.forEach(transactionId -> judge(transactionId, context, origin));
    }
}
