package com.ktc4.pusan4.merchant.classify;

import com.ktc4.pusan4.merchant.MerchantClassification;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

/**
 * 분류기가 가맹점 사전을 읽는 자리. 운영에서는 {@code MerchantDictionaryRepository::findAll} 을 넘긴다.
 *
 * <p>분류기를 DB 없이 단위 테스트하려고 리포지토리 대신 이 인터페이스에 기댄다.
 */
@FunctionalInterface
public interface MerchantDictionaryLookup {

    /**
     * {@code patterns} 중 사전에 있는 행을 개인·전역 구분 없이 모두 돌려준다.
     * 개인 행은 {@code ownerId == userId}, 전역 행은 {@code ownerId == null} 이다.
     */
    List<MerchantClassification> findAll(UUID userId, Collection<String> patterns);
}
