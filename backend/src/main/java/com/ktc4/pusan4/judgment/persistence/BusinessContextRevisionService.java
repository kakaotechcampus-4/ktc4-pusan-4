package com.ktc4.pusan4.judgment.persistence;

import com.ktc4.pusan4.user.domain.BusinessContext;
import com.ktc4.pusan4.user.domain.NewBusinessContext;
import com.ktc4.pusan4.user.persistence.BusinessContextService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/**
 * 문진 새 버전 저장(api.md 3.2)과 한도 집계를 한 트랜잭션으로 묶는다. 한도는 최신 문진의 직전연도 수입금액으로
 * 정해지므로, 문진을 고치면 바로 다시 집계한다(#218).
 * LimitSettlementService 가 BusinessContextService 를 쓰므로, 그 반대로 부르지 않고 여기서 둘을 잇는다.
 */
@Service
public class BusinessContextRevisionService {

    private final BusinessContextService contextService;
    private final LimitSettlementService limitSettlement;

    public BusinessContextRevisionService(
        BusinessContextService contextService,
        LimitSettlementService limitSettlement
    ) {
        this.contextService = contextService;
        this.limitSettlement = limitSettlement;
    }

    /** 문진 저장이 사용자 행을 잠그고, 집계도 같은 사용자 행만 잠근다. 거래 락은 잡지 않는다. */
    @Transactional
    public BusinessContext create(UUID userId, NewBusinessContext input) {
        BusinessContext context = contextService.create(userId, input);
        limitSettlement.settleProvisional(userId);
        return context;
    }
}
