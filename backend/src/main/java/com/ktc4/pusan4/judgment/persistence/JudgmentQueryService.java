package com.ktc4.pusan4.judgment.persistence;

import com.ktc4.pusan4.judgment.domain.JudgmentExportRow;
import com.ktc4.pusan4.judgment.domain.JudgmentExportRow.Answer;
import com.ktc4.pusan4.judgment.domain.JudgmentRevision;
import com.ktc4.pusan4.judgment.domain.JudgmentRevision.CitedStatute;
import com.ktc4.pusan4.judgment.domain.JudgmentSummary;
import com.ktc4.pusan4.judgment.domain.LimitYearTotal;
import com.ktc4.pusan4.judgment.domain.Question;
import com.ktc4.pusan4.judgment.domain.QuestionStatus;
import com.ktc4.pusan4.judgment.domain.Verdict;
import com.ktc4.pusan4.judgment.limit.EntertainmentLimit;
import com.ktc4.pusan4.judgment.persistence.JudgmentListQuery.Sort;
import com.ktc4.pusan4.judgment.persistence.JudgmentCitationRepository.CitationRow;
import com.ktc4.pusan4.judgment.persistence.LimitBucketEntryRepository.EntryAmount;
import com.ktc4.pusan4.shared.api.ApiException;
import com.ktc4.pusan4.user.persistence.BusinessContextService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * 판정 조회 (api.md 3.7). 저장은 {@link JudgmentService} 가 한다.
 *
 * <p>조회는 판정, 거래, 인용을 쿼리 여러 번으로 나눠 읽는다. 사이에 업로드 삭제가 커밋돼도 한 시점을 보도록
 * 읽기는 REPEATABLE READ 다({@link QuestionQueryService} 와 같은 이유).
 */
@Service
public class JudgmentQueryService {

    private final JudgmentRepository judgmentRepository;
    private final TransactionRecordRepository transactionRepository;
    private final JudgmentCitationRepository citationRepository;
    private final LimitBucketEntryRepository entryRepository;
    private final QuestionQueryService questionQueryService;
    private final BusinessContextService contextService;

    public JudgmentQueryService(
        JudgmentRepository judgmentRepository,
        TransactionRecordRepository transactionRepository,
        JudgmentCitationRepository citationRepository,
        LimitBucketEntryRepository entryRepository,
        QuestionQueryService questionQueryService,
        BusinessContextService contextService
    ) {
        this.judgmentRepository = judgmentRepository;
        this.transactionRepository = transactionRepository;
        this.citationRepository = citationRepository;
        this.entryRepository = entryRepository;
        this.questionQueryService = questionQueryService;
        this.contextService = contextService;
    }

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public JudgmentRevision get(UUID userId, UUID judgmentId) {
        JudgmentEntity judgment = judgmentRepository.findForUser(judgmentId, userId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "JUDGMENT_NOT_FOUND", "판정을 찾을 수 없습니다."));
        return toDomain(List.of(judgment)).getFirst();
    }

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public Page<JudgmentRevision> list(UUID userId, JudgmentListQuery query, int page, int size) {
        Page<JudgmentEntity> judgments = judgmentRepository.findPage(userId, query, PageRequest.of(page, size));
        return new PageImpl<>(toDomain(judgments.getContent()), judgments.getPageable(), judgments.getTotalElements());
    }

    /**
     * batchId·year·runId 중 하나로 집계한다. 대상은 같은 조건의 목록과 같다
     * (batchId·year 는 현재 판정, runId 는 그 Run 이 만든 판정).
     * year 요약만 접대비 판정을 finalAmount 대신 한도 인정액으로 더한다(소득세법 §35③ 초과분 불산입).
     * 한도는 연간 총액이라, 배치 하나에 돌아가는 몫은 배분 순서 없이 정할 수 없다(#15). 그래서 batchId 요약은
     * finalAmount 합이고, 초과액은 {@link #limits} 로 따로 준다.
     * 과거 Run 도 finalAmount 그대로다. 한도 항목은 지금 상태만 남아 그 Run 시점의 인정액이 아니다.
     */
    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public JudgmentSummary summary(UUID userId, UUID batchId, Integer year, UUID runId) {
        JudgmentListQuery query = new JudgmentListQuery(null, batchId, year, null, true, runId, null, Sort.COMPUTED_AT);
        Map<UUID, Long> limitAllowed = year == null ? Map.of() : limitAllowedAmounts(userId);
        return JudgmentSummary.of(judgmentRepository.findSummaryRows(userId, query).stream()
            .map(row -> new JudgmentSummary.Row(Verdict.valueOf(row.verdict()), row.account(),
                limitAllowed.getOrDefault(row.judgmentId(), row.finalAmount()), row.spendAmount(), row.awaiting(),
                row.year(), row.overridden()))
            .toList());
    }

    /**
     * 주어진 거래 가운데 답하지 않은 질문이 남은 거래. 판정 응답의 답변 대기 표지(awaitingAnswer)를 만든다.
     * 거래 id 는 부르는 쪽이 이미 사용자 범위로 읽은 판정에서 온다.
     */
    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public Set<UUID> pendingQuestionTransactionIds(Collection<UUID> transactionIds) {
        return questionQueryService.pendingTransactionIds(transactionIds);
    }

    /**
     * 세무사에게 넘길 내보내기 (api.md 3.7 export). batchId·year 중 하나의 현재 판정 전부와, 거래마다 답한 질문이다.
     * 인정 금액은 finalAmount 다. 접대비 판정은 그해 한도를 넘었으면 비운다. 넘은 해의 거래별 인정액은
     * 배분 순서로만 정해지고 법이 정하지 않아서다(#15). 그해 초과액은 {@link #limits} 가 준다.
     * 파일(CSV) 변환은 FE 가 한다.
     */
    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public List<JudgmentExportRow> export(UUID userId, UUID batchId, Integer year) {
        JudgmentListQuery query = new JudgmentListQuery(null, batchId, year, null, true, null, null, Sort.COMPUTED_AT);
        List<JudgmentRevision> judgments = toDomain(judgmentRepository.findPage(userId, query, Pageable.unpaged()).getContent());
        List<EntryAmount> entries = entryRepository.findEntryAmounts(userId, EntertainmentLimit.BUCKET);
        Map<UUID, EntryAmount> entryByJudgment = entries.stream()
            .collect(Collectors.toMap(EntryAmount::judgmentId, Function.identity()));
        Set<Integer> exceededYears = entries.stream()
            .collect(Collectors.groupingBy(EntryAmount::taxYear,
                Collectors.summingLong(entry -> entry.taggedAmount() - entry.allowedAmount())))
            .entrySet().stream()
            .filter(yearExcess -> yearExcess.getValue() > 0)
            .map(Map.Entry::getKey)
            .collect(Collectors.toSet());
        List<Question> questions = questionQueryService.find(userId, batchId, null);
        Map<UUID, List<Answer>> answers = answersByTransaction(questions);
        Set<UUID> pending = questions.stream()
            .filter(question -> question.status() == QuestionStatus.PENDING)
            .map(Question::transactionId)
            .collect(Collectors.toSet());
        return judgments.stream()
            .map(judgment -> new JudgmentExportRow(judgment,
                allowedAmount(judgment, entryByJudgment.get(judgment.id()), exceededYears),
                answers.getOrDefault(judgment.transactionId(), List.of()),
                pending.contains(judgment.transactionId())))
            .toList();
    }

    private static Long allowedAmount(JudgmentRevision judgment, EntryAmount entry, Set<Integer> exceededYears) {
        if (entry == null) {
            return judgment.finalAmount();
        }
        return exceededYears.contains(entry.taxYear()) ? null : entry.allowedAmount();
    }

    /**
     * batchId·year 범위에 접대비 판정이 있는 과세연도마다 한도 합계와 초과액 (api.md 3.7 limits). 과세연도 순이다.
     * 한도는 사용자의 한 해 전체 기준이라, batchId 범위여도 그해의 다른 batch 까지 합친 값이다. runId 범위는 없다.
     */
    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public List<LimitYearTotal> limits(UUID userId, UUID batchId, Integer year) {
        if (batchId == null && year == null) {
            return List.of();
        }
        Set<Integer> years = year != null
            ? Set.of(year)
            : Set.copyOf(entryRepository.findTaxYearsOfBatch(userId, EntertainmentLimit.BUCKET, batchId));
        Map<Integer, List<EntryAmount>> byYear = entryRepository.findEntryAmounts(userId, EntertainmentLimit.BUCKET)
            .stream()
            .filter(entry -> years.contains(entry.taxYear()))
            .collect(Collectors.groupingBy(EntryAmount::taxYear, TreeMap::new, Collectors.toList()));
        // 항목은 문진이 있어야 생긴다. 문진 전 사용자는 여기서 끝나 문진을 읽지 않는다.
        if (byYear.isEmpty()) {
            return List.of();
        }
        // 집계(LimitSettlementService.settleProvisional)와 같은 수입금액이라 초과액과 맞는다.
        // 문진을 고치면 같은 트랜잭션에서 다시 집계하므로 항목도 이 한도로 나뉘어 있다.
        long annualLimit = EntertainmentLimit.annual(contextService.current(userId).prevYearRevenue());
        return yearTotals(byYear, annualLimit);
    }

    /** 항목을 과세연도별로 더한다. 과세연도 순이다. */
    private static List<LimitYearTotal> yearTotals(Map<Integer, List<EntryAmount>> byYear, long annualLimit) {
        return byYear.entrySet().stream()
            .map(year -> new LimitYearTotal(EntertainmentLimit.BUCKET, year.getKey(), annualLimit,
                year.getValue().stream().mapToLong(EntryAmount::taggedAmount).sum(),
                year.getValue().stream().mapToLong(entry -> entry.taggedAmount() - entry.allowedAmount()).sum()))
            .toList();
    }

    private Map<UUID, Long> limitAllowedAmounts(UUID userId) {
        return entryRepository.findEntryAmounts(userId, EntertainmentLimit.BUCKET).stream()
            .collect(Collectors.toMap(EntryAmount::judgmentId, EntryAmount::allowedAmount));
    }

    /**
     * 거래마다 답한 질문. 질문은 revision 마다 새로 생기고 정정하면 같은 사실의 질문이 모두 새 답을 가리키므로,
     * 같은 factType 은 하나만 남긴다. 질문 목록이 생성 순이라 나중 revision 의 문구가 남는다.
     */
    private static Map<UUID, List<Answer>> answersByTransaction(List<Question> questions) {
        Map<UUID, Map<String, Answer>> byTransaction = new LinkedHashMap<>();
        questions.stream()
            .filter(question -> question.status() == QuestionStatus.ANSWERED && question.answer() != null)
            .forEach(question -> byTransaction.computeIfAbsent(question.transactionId(), id -> new LinkedHashMap<>())
                .put(question.factType(), new Answer(question.questionText(), question.answer())));
        return byTransaction.entrySet().stream()
            .collect(Collectors.toMap(Map.Entry::getKey, entry -> List.copyOf(entry.getValue().values())));
    }

    /** 거래와 인용을 판정마다 따로 읽지 않도록 한 번에 읽어 붙인다. */
    private List<JudgmentRevision> toDomain(List<JudgmentEntity> judgments) {
        Map<UUID, TransactionRecordEntity> transactions = transactionRepository
            .findByIdIn(judgments.stream().map(JudgmentEntity::transactionId).toList()).stream()
            .collect(Collectors.toMap(TransactionRecordEntity::id, Function.identity()));
        Map<UUID, List<CitedStatute>> citations = citationRepository
            .findRows(judgments.stream().map(JudgmentEntity::id).toList()).stream()
            .collect(Collectors.groupingBy(CitationRow::judgmentId,
                Collectors.mapping(CitationRow::toCited, Collectors.toList())));
        return judgments.stream()
            .map(judgment -> judgment.toDomain(
                transactions.get(judgment.transactionId()).toJudged(),
                citations.getOrDefault(judgment.id(), List.of())))
            .toList();
    }
}
