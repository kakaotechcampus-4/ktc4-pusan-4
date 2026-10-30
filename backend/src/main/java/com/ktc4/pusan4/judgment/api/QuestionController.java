package com.ktc4.pusan4.judgment.api;

import com.ktc4.pusan4.judgment.domain.AnswerSource;
import com.ktc4.pusan4.judgment.domain.PendingTotal;
import com.ktc4.pusan4.judgment.domain.Question;
import com.ktc4.pusan4.judgment.domain.QuestionGroup;
import com.ktc4.pusan4.judgment.domain.QuestionStatus;
import com.ktc4.pusan4.judgment.persistence.QuestionAnswerService;
import com.ktc4.pusan4.judgment.persistence.QuestionQueryService;
import com.ktc4.pusan4.judgment.persistence.QuestionSuggestionService;
import com.ktc4.pusan4.shared.api.ErrorResponse;
import com.ktc4.pusan4.shared.api.MockResponse;
import com.ktc4.pusan4.shared.api.PageResponse;
import com.ktc4.pusan4.shared.auth.CurrentUser;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@Tag(name = "questions", description = "룰엔진 확인 질문 (api.md 3.9~3.12). 사용자가 질문을 직접 취소하는 API 는 없다")
@RestController
public class QuestionController {

    private final JudgmentMockData mockData;
    private final QuestionQueryService queryService;
    private final QuestionAnswerService answerService;
    private final QuestionSuggestionService suggestionService;

    public QuestionController(
        JudgmentMockData mockData,
        QuestionQueryService queryService,
        QuestionAnswerService answerService,
        QuestionSuggestionService suggestionService
    ) {
        this.mockData = mockData;
        this.queryService = queryService;
        this.answerService = answerService;
        this.suggestionService = suggestionService;
    }

    @Operation(summary = "지난번 답",
        description = "이 Batch 의 PENDING 질문 그룹마다 같은 사용자의 다른 업로드에서 한 답을 등급(A 이어받기, B 이력만, "
            + "C 띄우지 않음)과 함께 준다. 읽기만 하고, 적용은 POST /question-responses 로 한다. 규칙은 api.md 3.14")
    @ApiResponse(responseCode = "404", description = "BATCH_NOT_FOUND",
        content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    @GetMapping("/questions/suggestions")
    public QuestionSuggestionResponse.Page suggestions(CurrentUser currentUser, @RequestParam UUID batchId) {
        return new QuestionSuggestionResponse.Page(suggestionService.suggest(currentUser.id(), batchId).stream()
            .map(QuestionSuggestionResponse::from)
            .toList());
    }

    @Operation(summary = "룰엔진 확인 질문 목록",
        description = "정렬: createdAt ASC, id ASC. runId 는 조회 기준으로 쓰지 않는다. "
            + "grouped=true 이면 항목이 그룹 형태로 바뀌고, 그룹은 count DESC, totalAmount DESC, 그룹 첫 질문 id ASC 순이다. "
            + "지금 판정 대상이 아닌 거래의 질문은 목록과 미해소 집계에서 뺀다")
    @ApiResponse(responseCode = "200", description = "grouped 값에 따라 두 형태 중 하나",
        content = @Content(schema = @Schema(oneOf = {QuestionPage.class, QuestionGroupPage.class})))
    @GetMapping("/questions")
    public Object list(
        CurrentUser currentUser,
        @RequestParam(required = false) UUID batchId,
        @RequestParam(required = false) UUID transactionId,
        @RequestParam(required = false) QuestionStatus status,
        @RequestParam(defaultValue = "false") boolean grouped,
        @RequestParam(defaultValue = "0") @Min(0) int page,
        @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size
    ) {
        List<Question> questions = queryService.find(currentUser.id(), batchId, transactionId);
        // 미해소 집계는 status·grouped·page 를 적용하기 전 목록으로 센다 (api.md 3.9)
        PendingTotal pending = PendingTotal.of(questions);
        Unresolved unresolved = new Unresolved(pending.count(), pending.amount());
        List<Question> matched = questions.stream()
            .filter(question -> status == null || question.status() == status)
            .toList();
        if (grouped) {
            PageResponse<QuestionGroupResponse> groups =
                PageResponse.of(slice(QuestionGroup.group(matched), page, size).map(QuestionGroupResponse::from));
            return new QuestionGroupPage(groups.items(), unresolved, groups.page());
        }
        PageResponse<QuestionResponse> items =
            PageResponse.of(slice(matched, page, size).map(QuestionResponse::from));
        return new QuestionPage(items.items(), unresolved, items.page());
    }

    private static <T> Page<T> slice(List<T> items, int page, int size) {
        int from = (int) Math.min((long) page * size, items.size());
        int to = Math.min(from + size, items.size());
        return new PageImpl<>(items.subList(from, to), PageRequest.of(page, size), items.size());
    }

    @Operation(summary = "확인 질문 응답 및 부분 재판정",
        description = "PENDING 은 최초 답변, ANSWERED 는 정정(UserFact 새 version). 새 JudgmentRun 은 만들지 않는다. "
            + "같은 Batch·groupKey·factType 의 CANCELED 가 아닌 질문을 모두 같은 UserFact 로 바꾸고 재판정 대상에 넣는다. "
            + "가맹점 단위 질문이면 같은 Batch 의 그 가맹점 거래 중 판정 대상이면서 판정한 적이 있는 거래도 재판정한다. "
            + "answeredCount 는 함께 처리된 수까지 센다. 처리 순서는 api.md 3.10")
    @ApiResponse(responseCode = "404", description = "QUESTION_NOT_FOUND",
        content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    @ApiResponse(responseCode = "409", description = "QUESTION_NOT_ANSWERABLE, QUESTION_GROUP_MISMATCH",
        content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    @ApiResponse(responseCode = "422", description = "INVALID_ANSWER_VALUE, QUESTIONS_FROM_DIFFERENT_BATCHES",
        content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    @PostMapping("/question-responses")
    public QuestionAnswerResponse answer(CurrentUser currentUser, @Valid @RequestBody QuestionAnswerRequest request) {
        return QuestionAnswerResponse.from(
            answerService.answer(currentUser.id(), request.questionIds(), request.answer().value(),
                request.source() == null ? AnswerSource.USER : request.source())
        );
    }

    @MockResponse
    @Operation(summary = "미해소 질문 일괄 응답",
        description = "batchId·PENDING·factType 이 모두 일치하는 질문을 한 번에 닫는다. 대상 중 하나라도 "
            + "answer.value 를 허용하지 않으면 아무것도 바꾸지 않는다. 대상이 0건이면 answeredCount = 0 (에러 아님)")
    @ApiResponse(responseCode = "404", description = "BATCH_NOT_FOUND",
        content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    @ApiResponse(responseCode = "422", description = "INVALID_ANSWER_VALUE, UNKNOWN_FACT_TYPE",
        content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    @PostMapping("/questions/bulk-answer")
    public BulkAnswerResponse bulkAnswer(@RequestBody BulkAnswerRequest request) {
        return mockData.bulkAnswer();
    }
}
