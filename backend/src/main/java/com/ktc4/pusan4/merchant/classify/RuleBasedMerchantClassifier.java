package com.ktc4.pusan4.merchant.classify;

import com.ktc4.pusan4.merchant.MerchantClassification;
import com.ktc4.pusan4.merchant.normalize.T1Normalizer;
import com.ktc4.pusan4.merchant.normalize.T1Result;
import com.ktc4.pusan4.merchant.pg.PgBlockResult;
import com.ktc4.pusan4.merchant.pg.PgBlocklist;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * 규칙 기반 분류기. 순서는 PG 차단 → 개인 사전 → 전역 사전 → 키워드룰 → 미분류다.
 *
 * <ul>
 *   <li><b>PG 가 사전보다 먼저다.</b> PG 명의는 가맹점이 아니라서 사전에 한 번 들어가면 그 PG 를 거친 모든 결제가
 *       같은 카테고리로 굳는다({@code pg_blocklist.yaml} 의 {@code seed_insert: false}). 그래서 PG 거래는 사전을
 *       조회하지도 않는다. 카테고리는 정식 값 {@code PG_미상} 이고 되묻기는 룰카드 R-105 가 한다</li>
 *   <li><b>사전은 normKey 정확 일치다.</b> 지점이 달라도 같은 키가 나오므로 한 줄이 모든 지점을 받는다.
 *       B8 은 분류 검토 응답을 같은 값(거래의 {@code merchant_norm})으로 개인 사전에 쓴다</li>
 *   <li><b>개인이 전역보다 먼저다.</b> 사용자가 직접 정한 답이 공용 시드보다 우선한다</li>
 *   <li><b>uncertain 룰은 분류가 아니다.</b> 미분류로 두고 힌트만 남긴다</li>
 * </ul>
 * 분류기는 사전을 읽기만 한다. 쓰는 쪽은 시드(전역)와 B8(개인)이다.
 */
public final class RuleBasedMerchantClassifier implements MerchantClassifier {

    private final T1Normalizer normalizer;
    private final PgBlocklist pgBlocklist;
    private final KeywordRules keywordRules;
    private final MerchantDictionaryLookup dictionary;

    public RuleBasedMerchantClassifier(
            T1Normalizer normalizer,
            PgBlocklist pgBlocklist,
            KeywordRules keywordRules,
            MerchantDictionaryLookup dictionary
    ) {
        this.normalizer = Objects.requireNonNull(normalizer);
        this.pgBlocklist = Objects.requireNonNull(pgBlocklist);
        this.keywordRules = Objects.requireNonNull(keywordRules);
        this.dictionary = Objects.requireNonNull(dictionary);
    }

    @Override
    public List<ClassificationResult> classifyAll(UUID userId, List<ClassificationInput> inputs) {
        List<Prepared> prepared = new ArrayList<>(inputs.size());
        Set<String> lookupKeys = new LinkedHashSet<>();
        for (ClassificationInput input : inputs) {
            Prepared p = prepare(input);
            prepared.add(p);
            if (p.needsDictionary()) {
                lookupKeys.add(p.normalized().normKey());
            }
        }

        Dictionary dict = Dictionary.of(userId, lookupKeys.isEmpty() ? List.of() : dictionary.findAll(userId, lookupKeys));

        List<ClassificationResult> results = new ArrayList<>(prepared.size());
        for (Prepared p : prepared) {
            results.add(classify(p, dict));
        }
        return results;
    }

    private Prepared prepare(ClassificationInput input) {
        String raw = input.merchantRaw() == null ? "" : input.merchantRaw();
        if (raw.isBlank()) {
            return new Prepared(raw, null, PgBlockResult.notBlocked());
        }
        T1Result normalized = normalizer.normalize(raw, input.bizNo() == null ? "" : input.bizNo());
        return new Prepared(raw, normalized, pgBlocklist.check(normalized));
    }

    private ClassificationResult classify(Prepared p, Dictionary dict) {
        if (p.normalized() == null) {
            return ClassificationResult.unclassified("", "");
        }
        String normKey = p.normalized().normKey();

        if (p.pg().blocked()) {
            return new ClassificationResult(normKey, p.pg().category(), ClassificationStage.PG,
                    String.join(", ", p.pg().pgTokens()), String.join(", ", p.pg().hintTokens()));
        }

        MerchantClassification personal = dict.personal().get(normKey);
        if (personal != null) {
            return new ClassificationResult(normKey, personal.category(), ClassificationStage.PERSONAL_DICT, null, "");
        }
        MerchantClassification global = dict.global().get(normKey);
        if (global != null) {
            return new ClassificationResult(normKey, global.category(), ClassificationStage.GLOBAL_DICT, null, "");
        }

        Optional<KeywordMatch> keyword = keywordRules.classify(p.raw(), p.normalized().stringNorm());
        if (keyword.isPresent() && !keyword.get().uncertain()) {
            KeywordMatch k = keyword.get();
            return new ClassificationResult(normKey, k.category(), ClassificationStage.KEYWORD, k.pattern(), "");
        }
        return ClassificationResult.unclassified(normKey, keyword.map(KeywordMatch::hint).orElse(""));
    }

    private record Prepared(String raw, T1Result normalized, PgBlockResult pg) {
        boolean needsDictionary() {
            return normalized != null && !pg.blocked() && !normalized.normKey().isEmpty();
        }
    }

    /** 사전 조회 결과를 normKey 로 찾을 수 있게 개인·전역으로 나눈다. 다른 사용자의 행은 버린다. */
    private record Dictionary(Map<String, MerchantClassification> personal, Map<String, MerchantClassification> global) {
        static Dictionary of(UUID userId, List<MerchantClassification> rows) {
            Map<String, MerchantClassification> personal = new HashMap<>();
            Map<String, MerchantClassification> global = new HashMap<>();
            for (MerchantClassification row : rows) {
                if (row.ownerId() == null) {
                    global.putIfAbsent(row.pattern(), row);
                } else if (row.ownerId().equals(userId)) {
                    personal.putIfAbsent(row.pattern(), row);
                }
            }
            return new Dictionary(personal, global);
        }
    }
}
