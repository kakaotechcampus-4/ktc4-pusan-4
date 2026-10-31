package com.ktc4.pusan4.transaction.persistence;

import org.springframework.data.repository.Repository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

interface MerchantModelDecisionRepository extends Repository<MerchantModelDecisionEntity, UUID> {

    List<MerchantModelDecisionEntity> findByTransactionIdIn(Collection<UUID> transactionIds);
}
