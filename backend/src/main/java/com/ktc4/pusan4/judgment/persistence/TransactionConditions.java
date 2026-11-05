package com.ktc4.pusan4.judgment.persistence;

import com.ktc4.pusan4.transaction.api.ClassificationStatus;
import com.ktc4.pusan4.transaction.api.SourceStatus;
import com.ktc4.pusan4.transaction.api.UserInclusion;
import com.ktc4.pusan4.transaction.domain.TransactionDetail;
import com.querydsl.core.types.dsl.BooleanExpression;
import com.querydsl.core.types.dsl.StringPath;

import java.util.Arrays;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 거래의 effectiveStatus(api.md 2.3)와 "지금 판정 대상" 을 거르는 쿼리 조건. 이 조건을 쓰는 쿼리는 모두 여기서 가져간다.
 *
 * <p>규칙의 원본은 {@link TransactionDetail#effectiveStatus(SourceStatus, UserInclusion)} 하나다. 여기에 규칙을 다시
 * 적지 않는다. DB 는 Java 함수를 부를 수 없고, 함수 안의 분기를 SQL 로 옮겨 적을 방법도 없다. 그래서 입력이 될 수 있는
 * 9가지(sourceStatus 3 × userInclusion 3)를 모두 함수에 넣어 보고, 원하는 결과가 나온 입력만 조건으로 옮긴다.
 * 거래마다 하는 일이 아니라 이 클래스를 읽을 때 한 번 한다. 예를 들어 JUDGEABLE 은 다음 조건이 된다.
 * <pre>
 * (source_status = 'JUDGEABLE' and (user_inclusion = 'AUTO' or user_inclusion = 'INCLUDED'))
 *   or (source_status = 'EXCLUDED' and user_inclusion = 'INCLUDED')
 * </pre>
 * 입력이 enum 몇 개뿐이라 경우를 다 나열할 수 있는 규칙에만 쓰는 방식이다.
 *
 * <p>userInclusion 은 {@code in (목록)} 이 아니라 {@code =} 를 or 로 잇는다. 목록 파라미터가 있으면 Hibernate 가 쿼리를
 * 실행할 때마다 SQL 로 다시 옮겨, 호출마다 1ms 안팎이 더 들었다(#162 측정, DB 실행 시간은 같았다).
 *
 * <p>DB 의 source_status·user_inclusion 문자열이 enum 이름과 같다는 데 기댄다({@link TransactionRecordEntity#toDetail()} 도
 * 같은 전제다). 뽑아낸 조건과 이 전제는 TransactionConditionsIntegrationTest 가 모든 조합으로 확인한다.
 */
public final class TransactionConditions {

    // effectiveStatus → (sourceStatus → 그 effectiveStatus 가 나오는 userInclusion 들). 값은 모두 DB 문자열(enum 이름)이다.
    private static final Map<SourceStatus, Map<String, List<String>>> INPUTS = inputsByEffectiveStatus();

    private TransactionConditions() {
    }

    /** effectiveStatus 가 status 인 거래. */
    public static BooleanExpression effectiveStatusIs(QTransactionRecordEntity transaction, SourceStatus status) {
        return INPUTS.get(status).entrySet().stream()
            .map(input -> transaction.sourceStatus.eq(input.getKey()).and(anyOf(transaction.userInclusion, input.getValue())))
            .reduce(BooleanExpression::or)
            // 빈 조건은 QueryDSL 이 무시해 거래 전체를 돌려준다. 그렇게 조용히 넘어가지 않게 막는다.
            .orElseThrow(() -> new IllegalStateException("effectiveStatus 가 " + status + " 인 입력이 없다"));
    }

    /** 지금 판정 대상인 거래: 분류를 마쳤고 effectiveStatus 가 JUDGEABLE 이다(api.md 3.6). */
    public static BooleanExpression judgmentTarget(QTransactionRecordEntity transaction) {
        return transaction.classificationStatus.eq(ClassificationStatus.CLASSIFIED.name())
            .and(effectiveStatusIs(transaction, SourceStatus.JUDGEABLE));
    }

    /** path = values 중 하나. in 대신 쓰는 이유는 클래스 주석에 있다. values 는 비어 있지 않다(inputsByEffectiveStatus). */
    private static BooleanExpression anyOf(StringPath path, List<String> values) {
        return values.stream().map(path::eq).reduce(BooleanExpression::or).orElseThrow();
    }

    private static Map<SourceStatus, Map<String, List<String>>> inputsByEffectiveStatus() {
        Map<SourceStatus, Map<String, List<String>>> inputs = new EnumMap<>(SourceStatus.class);
        for (SourceStatus effective : SourceStatus.values()) {
            Map<String, List<String>> bySource = new LinkedHashMap<>();
            for (SourceStatus source : SourceStatus.values()) {
                List<String> inclusions = Arrays.stream(UserInclusion.values())
                    .filter(inclusion -> TransactionDetail.effectiveStatus(source, inclusion) == effective)
                    .map(Enum::name)
                    .toList();
                if (!inclusions.isEmpty()) {
                    bySource.put(source.name(), inclusions);
                }
            }
            inputs.put(effective, bySource);
        }
        return inputs;
    }
}
