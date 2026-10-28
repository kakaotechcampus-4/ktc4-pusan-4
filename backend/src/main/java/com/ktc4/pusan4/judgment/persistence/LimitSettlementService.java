package com.ktc4.pusan4.judgment.persistence;

import com.ktc4.pusan4.judgment.limit.AnnualLimitAllocator;
import com.ktc4.pusan4.judgment.limit.EntertainmentLimit;
import com.ktc4.pusan4.judgment.limit.LimitCandidate;
import com.ktc4.pusan4.judgment.persistence.JudgmentRepository.LimitTagged;
import com.ktc4.pusan4.user.persistence.BusinessContextService;
import jakarta.persistence.NoResultException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.UUID;

/**
 * 접대비 한도 잠정 집계 (CONTEXT.md §4 집계 단계). 사용자의 현재 판정(api.md §5) 중 가능이면서
 * limit_bucket 이 접대비인 것을 과세연도별로 모아 한도를 배분하고 limit_bucket_entry 를 잠정으로 갈아 끼운다.
 * 한도는 사용자의 한 해 전체 기준이라 batch 단위로 계산하지 않는다.
 * 한도 인정액은 판정의 finalAmount 에 넣지 않고 여기에만 둔다(api.md 3.7).
 */
@Service
public class LimitSettlementService {

    private final UserFactRepository userFactRepository;
    private final JudgmentRepository judgmentRepository;
    private final LimitBucketEntryRepository entryRepository;
    private final BusinessContextService contextService;
    private final LimitBucketPersistenceService limitService;

    public LimitSettlementService(
        UserFactRepository userFactRepository,
        JudgmentRepository judgmentRepository,
        LimitBucketEntryRepository entryRepository,
        BusinessContextService contextService,
        LimitBucketPersistenceService limitService
    ) {
        this.userFactRepository = userFactRepository;
        this.judgmentRepository = judgmentRepository;
        this.entryRepository = entryRepository;
        this.contextService = contextService;
        this.limitService = limitService;
    }

    /**
     * run 이 끝날 때와 재판정(질문 답변 등) 뒤에 부른다. override·거래 제외/포함·batch 삭제 뒤에는 아직 부르지 않는다.
     * 수입금액은 최신 문진의 직전연도 수입금액이다(연중 잠정치, CONTEXT.md §4 잠정/확정).
     */
    @Transactional
    public void settleProvisional(UUID userId) {
        // 같은 사용자의 집계끼리 limit_bucket_entry 를 동시에 갈아 끼우지 않게 사용자 락을 잡는다.
        // 재판정 쪽은 UserFact 저장에서 이미 잡았다(같은 트랜잭션이라 다시 잡아도 된다).
        userFactRepository.lockUser(userId).orElseThrow(NoResultException::new);
        long annualLimit = EntertainmentLimit.annual(contextService.current(userId).prevYearRevenue());

        Map<Integer, List<LimitCandidate>> byYear = new HashMap<>();
        for (LimitTagged tagged : judgmentRepository.findCurrentLimitTagged(userId, EntertainmentLimit.BUCKET)) {
            // 금액 계산 전에 저장된 판정은 결제금액으로 본다. 접대비에는 안분·상각이 없다.
            long amount = tagged.finalAmount() == null ? tagged.amount() : tagged.finalAmount();
            // 승인취소·환불(음수 금액)은 접대비 지출이 아니라 한도를 나눠 받을 차례에 넣지 않는다.
            // 넣으면 배분기가 음수를 거부해, 이 사용자의 run 완료와 질문 답변이 모두 실패한다.
            if (amount < 0) {
                continue;
            }
            byYear.computeIfAbsent(tagged.approvedAt().getYear(), year -> new ArrayList<>())
                .add(new LimitCandidate(tagged.judgmentId(), tagged.approvedAt(), amount));
        }
        // 접대비가 모두 빠진 해에 남은 항목도 비운다.
        Set<Integer> years = new TreeSet<>(byYear.keySet());
        years.addAll(entryRepository.findTaxYears(userId, EntertainmentLimit.BUCKET));
        years.forEach(year -> limitService.replaceProvisional(userId, year, EntertainmentLimit.BUCKET,
            AnnualLimitAllocator.allocate(annualLimit, byYear.getOrDefault(year, List.of()))));
    }
}
