package com.ktc4.pusan4.admin.persistence;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ktc4.pusan4.admin.domain.RuleCandidate;
import com.ktc4.pusan4.admin.domain.RuleCandidate.SuggestedDoc;
import com.ktc4.pusan4.admin.domain.RuleCandidateStatus;
import com.ktc4.pusan4.shared.api.ApiException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;

/**
 * 규칙 후보 조회와 승인·기각 (M1). 승인해도 규칙 카드를 만들지는 않는다 — 카드 PR 은 사람이 올린다.
 *
 * <p>rule_candidate 는 AI 파이프라인(ai/pipeline/candidates.py)이 쓰고, suggested_docs 는
 * {@code [{statute_id, quote, tier}]} 모양이라 JPA 엔티티(RuleCandidateEntity)로 읽지 않고 SQL 로 읽는다.
 */
@Service
public class RuleCandidateReviewService {

    private static final ZoneId KST = ZoneId.of("Asia/Seoul");
    private static final List<String> REVIEWABLE = List.of(
        RuleCandidateStatus.PENDING.dbValue(), RuleCandidateStatus.IN_REVIEW.dbValue(),
        RuleCandidateStatus.ON_HOLD.dbValue());

    private final JdbcClient jdbc;
    private final ObjectMapper objectMapper;

    RuleCandidateReviewService(JdbcClient jdbc, ObjectMapper objectMapper) {
        this.jdbc = jdbc;
        this.objectMapper = objectMapper;
    }

    /** 최신순(createdAt DESC, id DESC). status 가 null 이면 전체다. */
    @Transactional(readOnly = true)
    public Page<RuleCandidate> list(RuleCandidateStatus status, int page, int size) {
        String where = status == null ? "" : " where status = :status";
        String dbStatus = status == null ? null : status.dbValue();
        List<RuleCandidate> items = jdbc.sql("select * from rule_candidate" + where
                + " order by created_at desc, id desc limit :limit offset :offset")
            .param("status", dbStatus)
            .param("limit", size)
            .param("offset", (long) page * size)
            .query(this::map)
            .list();
        long total = jdbc.sql("select count(*) from rule_candidate" + where)
            .param("status", dbStatus)
            .query(Long.class)
            .single();
        return new PageImpl<>(items, PageRequest.of(page, size), total);
    }

    /**
     * 승인·기각하고 검토한 사람·시각을 남긴다. 대기·검토중·보류만 바꿀 수 있고, 이미 승인·기각한 후보는 409 다.
     * 확인과 변경을 UPDATE 한 문장으로 해서 두 관리자가 동시에 눌러도 한 번만 바뀐다.
     */
    @Transactional
    public RuleCandidate review(long candidateId, RuleCandidateStatus decision, String reviewer) {
        return jdbc.sql("""
                update rule_candidate
                   set status = :decision, reviewed_by = :reviewer, reviewed_at = now()
                 where id = :id and status in (:reviewable)
                returning *
                """)
            .param("decision", decision.dbValue())
            .param("reviewer", reviewer)
            .param("id", candidateId)
            .param("reviewable", REVIEWABLE)
            .query(this::map)
            .optional()
            .orElseThrow(() -> notReviewable(candidateId));
    }

    private ApiException notReviewable(long candidateId) {
        boolean exists = jdbc.sql("select exists(select 1 from rule_candidate where id = :id)")
            .param("id", candidateId)
            .query(Boolean.class)
            .single();
        return exists
            ? new ApiException(HttpStatus.CONFLICT, "CONFLICT", "이미 처리한 후보입니다.")
            : new ApiException(HttpStatus.NOT_FOUND, "RULE_CANDIDATE_NOT_FOUND", "규칙 후보를 찾을 수 없습니다.");
    }

    private RuleCandidate map(ResultSet rs, int row) throws SQLException {
        return new RuleCandidate(
            rs.getLong("id"),
            rs.getString("merchant_category"),
            rs.getString("industry_code"),
            rs.getInt("distinct_users"),
            rs.getInt("occurrence_count"),
            docs(rs.getString("suggested_docs")),
            rs.getString("searched_tier"),
            rs.getString("draft_yaml"),
            RuleCandidateStatus.fromDb(rs.getString("status")),
            rs.getString("reviewed_by"),
            kst(rs.getObject("reviewed_at", OffsetDateTime.class)),
            kst(rs.getObject("created_at", OffsetDateTime.class)));
    }

    /** DB 에서 읽은 timestamptz 는 UTC 로 오므로 다른 응답과 같은 KST 표기로 되돌린다. */
    private static OffsetDateTime kst(OffsetDateTime value) {
        return value == null ? null : value.atZoneSameInstant(KST).toOffsetDateTime();
    }

    private List<SuggestedDoc> docs(String json) {
        try {
            List<SuggestedDoc> docs = new ArrayList<>();
            for (JsonNode doc : objectMapper.readTree(json)) {
                docs.add(new SuggestedDoc(text(doc, "statute_id"), text(doc, "quote"), text(doc, "tier")));
            }
            return docs;
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("rule_candidate.suggested_docs 를 읽지 못했다", e);
        }
    }

    private static String text(JsonNode doc, String field) {
        JsonNode value = doc.get(field);
        return value == null || value.isNull() ? null : value.asText();
    }
}
