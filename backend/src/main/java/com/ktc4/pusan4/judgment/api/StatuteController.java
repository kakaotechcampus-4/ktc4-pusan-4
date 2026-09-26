package com.ktc4.pusan4.judgment.api;

import com.ktc4.pusan4.shared.api.ApiException;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "statutes", description = "법령 (api.md 3.13)")
@RestController
@RequestMapping("/statutes")
public class StatuteController {

    @Operation(summary = "법령 원문 조회")
    @GetMapping("/{statuteVersionId}")
    public StatuteResponse detail(@PathVariable long statuteVersionId) {
        throw ApiException.notImplemented();
    }
}
