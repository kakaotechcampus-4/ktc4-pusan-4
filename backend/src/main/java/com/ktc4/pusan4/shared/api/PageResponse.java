package com.ktc4.pusan4.shared.api;

import io.swagger.v3.oas.annotations.media.Schema;
import org.springframework.data.domain.Page;

import java.util.List;

@Schema(description = "목록 응답 (api.md 1.4)")
public record PageResponse<T>(List<T> items, PageMeta page) {

    public static <T> PageResponse<T> of(Page<T> page) {
        return new PageResponse<>(page.getContent(), new PageMeta(
            page.getNumber(), page.getSize(), page.getTotalElements(), page.getTotalPages(), page.hasNext()
        ));
    }

    @Schema(description = "페이지 정보. page 기본 0, size 기본 20 · 최대 100")
    public record PageMeta(int number, int size, long totalElements, int totalPages, boolean hasNext) {
    }
}
