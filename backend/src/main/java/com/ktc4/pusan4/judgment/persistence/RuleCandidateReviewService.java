package com.ktc4.pusan4.judgment.persistence;

import com.ktc4.pusan4.judgment.domain.RuleCandidate;
import com.ktc4.pusan4.judgment.domain.RuleCandidateStatus;
import com.ktc4.pusan4.shared.api.ApiException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 관리자의 규칙 후보 조회와 승인·기각 (M1, api.md 3.15). 승인해도 규칙 카드를 만들지는 않는다 — 카드 PR 은 사람이 올린다.
 * 데이터 접근은 두 Repository 에 두고, 여기서는 상태로 409·404 를 가르는 판단만 한다.
 */
@Service
public class RuleCandidateReviewService {

    private static final Sort NEWEST_FIRST = Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id"));

    private final RuleCandidateRepository candidates;
    private final RuleCandidateReviewRepository reviews;

    RuleCandidateReviewService(RuleCandidateRepository candidates, RuleCandidateReviewRepository reviews) {
        this.candidates = candidates;
        this.reviews = reviews;
    }

    /** 최신순(createdAt DESC, id DESC). status 가 null 이면 전체다. */
    @Transactional(readOnly = true)
    public Page<RuleCandidate> list(RuleCandidateStatus status, int page, int size) {
        PageRequest pageable = PageRequest.of(page, size, NEWEST_FIRST);
        Page<RuleCandidateEntity> found = status == null
            ? candidates.findAll(pageable)
            : candidates.findByStatus(status.dbValue(), pageable);
        return found.map(RuleCandidateEntity::toDomain);
    }

    /**
     * 승인·기각하고 검토한 사람·시각을 남긴다. 대기·검토중·보류만 바꿀 수 있고, 이미 승인·기각한 후보는 409, 없으면 404 다.
     * UPDATE 뒤에 다시 읽으므로 응답에는 DB 가 남긴 reviewed_at 이 그대로 실린다.
     */
    @Transactional
    public RuleCandidate review(long candidateId, RuleCandidateStatus decision, String reviewer) {
        if (!reviews.review(candidateId, decision, reviewer)) {
            throw candidates.existsById(candidateId)
                ? new ApiException(HttpStatus.CONFLICT, "CONFLICT", "이미 처리한 후보입니다.")
                : new ApiException(HttpStatus.NOT_FOUND, "RULE_CANDIDATE_NOT_FOUND", "규칙 후보를 찾을 수 없습니다.");
        }
        return candidates.findById(candidateId)
            .map(RuleCandidateEntity::toDomain)
            .orElseThrow(() -> new IllegalStateException("방금 바꾼 규칙 후보가 없다: " + candidateId));
    }
}
