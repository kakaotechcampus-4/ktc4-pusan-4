package com.ktc4.pusan4.handoff.api;

import com.ktc4.pusan4.handoff.domain.HandoffNote;
import com.ktc4.pusan4.handoff.persistence.HandoffNoteService;
import com.ktc4.pusan4.shared.api.ErrorResponse;
import com.ktc4.pusan4.shared.auth.CurrentUser;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@Tag(name = "handoff-notes", description = "세무대리인에게 물을 질문 (api.md 3.14, docs/agent-secretary.md FR-16)")
@RestController
@RequestMapping("/handoff-notes")
public class HandoffNoteController {

    private final HandoffNoteService noteService;

    public HandoffNoteController(HandoffNoteService noteService) {
        this.noteService = noteService;
    }

    @Operation(summary = "세무대리인 질문 목록", description = "본인 질문 전부, 넣은 순서. 페이지네이션 없음")
    @GetMapping
    public List<HandoffNote> list(CurrentUser currentUser) {
        return noteService.list(currentUser.id());
    }

    @Operation(summary = "세무대리인 질문 저장", description = "비서가 제안한 질문을 사용자가 [적용]하면 저장한다")
    @ApiResponse(responseCode = "404", description = "TRANSACTION_NOT_FOUND — 붙인 거래가 없거나 남의 것",
        content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public HandoffNote create(CurrentUser currentUser, @Valid @RequestBody CreateHandoffNoteRequest request) {
        return noteService.create(currentUser.id(), request.text(), request.transactionIds());
    }
}
