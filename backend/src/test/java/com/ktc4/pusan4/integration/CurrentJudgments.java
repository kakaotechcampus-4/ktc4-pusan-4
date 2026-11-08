package com.ktc4.pusan4.integration;

import org.springframework.jdbc.core.JdbcTemplate;

/**
 * 현재 판정(api.md §5)을 정의대로 계산한다: 활성 override 가 있으면 그 override revision, 없으면 override 가 아닌
 * 최신 revision. 앱은 이 값을 transaction.current_judgment_id 에 저장해 두고 판정 저장·override·해제 때 바꾼다(#218).
 * 계산식은 V21 마이그레이션의 채우기와 같다.
 */
final class CurrentJudgments {

    private static final String DEFINITION = """
        (select j.id
         from judgment j
         where j.transaction_id = t.id
           and (
             j.judgment_override_id = (
               select o.id from judgment_override o where o.transaction_id = t.id and o.active
             )
             or (
               j.judgment_override_id is null
               and not exists (select 1 from judgment_override o where o.transaction_id = t.id and o.active)
             )
           )
         order by j.revision desc
         limit 1)""";

    private CurrentJudgments() {
    }

    /** SQL 로 판정·override 행을 직접 넣은 픽스처가, 앱이 했을 것처럼 거래의 현재 판정을 맞춘다. */
    static void refresh(JdbcTemplate jdbcTemplate) {
        jdbcTemplate.update("update transaction t set current_judgment_id = " + DEFINITION);
    }

    /** 저장된 현재 판정이 정의와 다른 거래 수. */
    static int mismatches(JdbcTemplate jdbcTemplate) {
        return jdbcTemplate.queryForObject(
            "select count(*) from transaction t where current_judgment_id is distinct from " + DEFINITION,
            Integer.class);
    }
}
