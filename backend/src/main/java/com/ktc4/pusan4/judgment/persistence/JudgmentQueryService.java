package com.ktc4.pusan4.judgment.persistence;

import com.ktc4.pusan4.judgment.domain.JudgmentExportRow;
import com.ktc4.pusan4.judgment.domain.JudgmentExportRow.Answer;
import com.ktc4.pusan4.judgment.domain.JudgmentRevision;
import com.ktc4.pusan4.judgment.domain.JudgmentRevision.CitedStatute;
import com.ktc4.pusan4.judgment.domain.JudgmentSummary;
import com.ktc4.pusan4.judgment.domain.LimitYearTotal;
import com.ktc4.pusan4.judgment.domain.Question;
import com.ktc4.pusan4.judgment.domain.QuestionStatus;
import com.ktc4.pusan4.judgment.limit.EntertainmentLimit;
import com.ktc4.pusan4.judgment.persistence.JudgmentCitationRepository.CitationRow;
import com.ktc4.pusan4.judgment.persistence.LimitBucketEntryRepository.EntryAmount;
import com.ktc4.pusan4.shared.api.ApiException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
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
 */
@Service
public class JudgmentQueryService {

    private final JudgmentRepository judgmentRepository;
    private final TransactionRecordRepository transactionRepository;
    private final JudgmentCitationRepository citationRepository;
    private final LimitBucketEntryRepository entryRepository;
    private final QuestionQueryService questionQueryService;

    public JudgmentQueryService(
        JudgmentRepository judgmentRepository,
        TransactionRecordRepository transactionRepository,
        JudgmentCitationRepository citationRepository,
        LimitBucketEntryRepository entryRepository,
        QuestionQueryService questionQueryService
    ) {
        this.judgmentRepository = judgmentRepository;
        this.transactionRepository = transactionRepository;
        this.citationRepository = citationRepository;
        this.entryRepository = entryRepository;
        this.questionQueryService = questionQueryService;
    }

    @Transactional(readOnly = true)
    public JudgmentRevision get(UUID userId, UUID judgmentId) {
        JudgmentEntity judgment = judgmentRepository.findForUser(judgmentId, userId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "JUDGMENT_NOT_FOUND", "판정을 찾을 수 없습니다."));
        return toDomain(List.of(judgment)).getFirst();
    }

    @Transactional(readOnly = true)
    public Page<JudgmentRevision> list(UUID userId, JudgmentListQuery query, int page, int size) {
        Page<JudgmentEntity> judgments = find(userId, query, PageRequest.of(page, size));
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
    @Transactional(readOnly = true)
    public JudgmentSummary summary(UUID userId, UUID batchId, Integer year, UUID runId) {
        JudgmentListQuery query = new JudgmentListQuery(null, batchId, year, null, true, runId);
        Map<UUID, Long> limitAllowed = year == null ? Map.of() : limitAllowedAmounts(userId);
        return JudgmentSummary.of(find(userId, query, Pageable.unpaged()).stream()
            .map(judgment -> judgment.toSummaryRow(limitAllowed.get(judgment.id())))
            .toList());
    }

    /**
     * 세무사에게 넘길 내보내기 (api.md 3.7 export). batchId·year 중 하나의 현재 판정 전부와, 거래마다 답한 질문이다.
     * 인정 금액은 finalAmount 다. 접대비 판정은 그해 한도를 넘었으면 비운다. 넘은 해의 거래별 인정액은
     * 배분 순서로만 정해지고 법이 정하지 않아서다(#15). 그해 초과액은 {@link #limits} 가 준다.
     * 파일(CSV) 변환은 FE 가 한다.
     */
    @Transactional(readOnly = true)
    public List<JudgmentExportRow> export(UUID userId, UUID batchId, Integer year) {
        JudgmentListQuery query = new JudgmentListQuery(null, batchId, year, null, true, null);
        List<JudgmentRevision> judgments = toDomain(find(userId, query, Pageable.unpaged()).getContent());
        List<EntryAmount> entries = entryRepository.findEntryAmounts(userId, EntertainmentLimit.BUCKET);
        Map<UUID, EntryAmount> entryByJudgment = entries.stream()
            .collect(Collectors.toMap(EntryAmount::judgmentId, Function.identity()));
        Set<Integer> exceededYears = yearTotals(entries).stream()
            .filter(LimitYearTotal::exceeded)
            .map(LimitYearTotal::taxYear)
            .collect(Collectors.toSet());
        Map<UUID, List<Answer>> answers = answersByTransaction(questionQueryService.find(userId, batchId, null));
        return judgments.stream()
            .map(judgment -> new JudgmentExportRow(judgment,
                allowedAmount(judgment, entryByJudgment.get(judgment.id()), exceededYears),
                answers.getOrDefault(judgment.transactionId(), List.of())))
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
    @Transactional(readOnly = true)
    public List<LimitYearTotal> limits(UUID userId, UUID batchId, Integer year) {
        if (batchId == null && year == null) {
            return List.of();
        }
        Set<Integer> years = year != null
            ? Set.of(year)
            : Set.copyOf(entryRepository.findTaxYearsOfBatch(userId, EntertainmentLimit.BUCKET, batchId));
        return yearTotals(entryRepository.findEntryAmounts(userId, EntertainmentLimit.BUCKET)).stream()
            .filter(total -> years.contains(total.taxYear()))
            .toList();
    }

    /** 항목을 과세연도별로 더한다. 과세연도 순이다. */
    private static List<LimitYearTotal> yearTotals(List<EntryAmount> entries) {
        Map<Integer, List<EntryAmount>> byYear = entries.stream()
            .collect(Collectors.groupingBy(EntryAmount::taxYear, TreeMap::new, Collectors.toList()));
        return byYear.entrySet().stream()
            .map(year -> new LimitYearTotal(EntertainmentLimit.BUCKET, year.getKey(),
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

    private Page<JudgmentEntity> find(UUID userId, JudgmentListQuery query, Pageable pageable) {
        LocalDate yearStart = query.year() == null ? null : LocalDate.of(query.year(), 1, 1);
        return judgmentRepository.findPage(userId, query.transactionId(), query.batchId(),
            yearStart, yearStart == null ? null : yearStart.plusYears(1),
            query.verdict() == null ? null : query.verdict().name(),
            query.runId(), !query.latestOnly(), pageable);
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
