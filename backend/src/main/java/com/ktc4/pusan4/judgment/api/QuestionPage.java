package com.ktc4.pusan4.judgment.api;

import com.ktc4.pusan4.shared.api.PageResponse.PageMeta;

import java.util.List;

/**
 * 문서용 타입. grouped 값에 따라 응답 항목 모양이 갈려서 두 형태를 oneOf 로 보여 준다.
 */
public record QuestionPage(List<QuestionResponse> items, Unresolved unresolved, PageMeta page) {
}
