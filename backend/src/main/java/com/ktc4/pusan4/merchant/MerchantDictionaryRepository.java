package com.ktc4.pusan4.merchant;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public class MerchantDictionaryRepository {

    private final JdbcClient jdbcClient;

    public MerchantDictionaryRepository(JdbcClient jdbcClient) {
        this.jdbcClient = jdbcClient;
    }

    public Optional<MerchantClassification> find(UUID userId, String pattern) {
        return jdbcClient.sql("""
                select user_id, pattern, merchant_norm, merchant_category,
                       source, resolved_evidence, confidence
                from merchant_dict
                where pattern = :pattern
                  and (user_id = :userId or user_id is null)
                order by case when user_id = :userId then 0 else 1 end
                limit 1
                """)
            .param("pattern", pattern)
            .param("userId", userId)
            .query((resultSet, rowNumber) -> new MerchantClassification(
                resultSet.getObject("user_id", UUID.class),
                resultSet.getString("pattern"),
                resultSet.getString("merchant_norm"),
                resultSet.getString("merchant_category"),
                resultSet.getString("source"),
                resultSet.getString("resolved_evidence"),
                resultSet.getBigDecimal("confidence")
            ))
            .optional();
    }
}
