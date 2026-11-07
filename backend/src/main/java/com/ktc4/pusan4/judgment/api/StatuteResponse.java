package com.ktc4.pusan4.judgment.api;

import com.ktc4.pusan4.judgment.domain.StatuteVersion;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDate;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public record StatuteResponse(
    @Schema(example = "1523") long statuteVersionId,
    @Schema(example = "소득세법시행령-67-4") String statuteId,
    @Schema(description = "법령이면 조·항·호까지 붙인 이름", example = "소득세법 시행령 제67조 제4항") String title,
    @Schema(description = "법률·시행령·기본통칙·판례 등 표시 구분", example = "시행령") String hierarchy,
    LocalDate effectiveFrom,
    LocalDate effectiveTo,
    String sourceUrl,
    String body
) {

    /** 법령 동기화(ai/pipeline/parse.py parse_law)가 법령에 붙이는 위계. 행정규칙·판례·해석례는 statuteId 모양이 다르다. */
    private static final Set<String> LAW_HIERARCHIES = Set.of("법률", "시행령", "시행규칙");
    /** 법령 statuteId: 법령명(공백 없음)-조[-항[-호]]. 조와 호는 가지번호(의N)가 붙을 수 있다. */
    private static final Pattern LAW_ID = Pattern.compile("[^-#]+-(\\d+(?:의\\d+)?)(?:-(\\d+)(?:-(\\d+(?:의\\d+)?))?)?");
    private static final Pattern ARTICLE_IN_TITLE = Pattern.compile("제\\d+조");
    private static final Pattern BRANCH_ARTICLE_IN_URL = Pattern.compile("제(\\d+)의(\\d+)조");

    static StatuteResponse from(StatuteVersion statute) {
        boolean law = LAW_HIERARCHIES.contains(statute.hierarchy());
        return new StatuteResponse(statute.id(), statute.statuteId(),
            law ? lawTitle(statute.title(), statute.statuteId()) : statute.title(), statute.hierarchy(),
            statute.effectiveFrom(), statute.effectiveTo(),
            law ? lawUrl(statute.sourceUrl()) : statute.sourceUrl(), statute.body());
    }

    /**
     * 동기화는 title 에 법령 이름만 넣는다. 화면, 비서, 내보내기가 같은 이름을 쓰도록 statuteId 로 조·항·호를 붙인다.
     * 이미 조가 붙은 제목(동기화가 바뀐 뒤의 행)은 그대로 둔다.
     */
    private static String lawTitle(String title, String statuteId) {
        Matcher id = LAW_ID.matcher(statuteId);
        if (!id.matches() || ARTICLE_IN_TITLE.matcher(title).find()) {
            return title;
        }
        StringBuilder name = new StringBuilder(title).append(' ').append(numbered(id.group(1), "조"));
        if (id.group(2) != null) {
            name.append(" 제").append(id.group(2)).append('항');
        }
        if (id.group(3) != null) {
            name.append(' ').append(numbered(id.group(3), "호"));
        }
        return name.toString();
    }

    /** '208의2' → '제208조의2' */
    private static String numbered(String number, String unit) {
        int branch = number.indexOf('의');
        return branch < 0
            ? "제" + number + unit
            : "제" + number.substring(0, branch) + unit + number.substring(branch);
    }

    /** 동기화가 만든 '제81의6조' 주소를 국가법령정보 주소 모양 '제81조의6' 으로 바꾼다. 옛 행도 고쳐진다. */
    private static String lawUrl(String sourceUrl) {
        return sourceUrl == null ? null : BRANCH_ARTICLE_IN_URL.matcher(sourceUrl).replaceAll("제$1조의$2");
    }
}
