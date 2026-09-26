package com.ktc4.pusan4.judgment.api;

import com.ktc4.pusan4.shared.api.PageResponse.PageMeta;

import java.util.List;

/**
 * 문서용 타입. {@link QuestionPage} 참고.
 */
public record QuestionGroupPage(List<QuestionGroupResponse> items, Unresolved unresolved, PageMeta page) {
}
