package com.ktc4.pusan4.judgment.api;

import com.ktc4.pusan4.shared.api.ErrorResponse;
import com.ktc4.pusan4.shared.api.MockResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@Tag(name = "questions", description = "룰엔진 확인 질문 (api.md 3.9~3.12). 사용자가 질문을 직접 취소하는 API 는 없다")
@RestController
public class QuestionController {

    private final JudgmentMockData mockData;

    public QuestionController(JudgmentMockData mockData) {
        this.mockData = mockData;
    }

    @MockResponse
    @Operation(summary = "룰엔진 확인 질문 목록",
        description = "정렬: createdAt ASC, id ASC. runId 는 조회 기준으로 쓰지 않는다. "
            + "grouped=true 이면 항목이 그룹 형태로 바뀐다")
    @ApiResponse(responseCode = "200", description = "grouped 값에 따라 두 형태 중 하나",
        content = @Content(schema = @Schema(oneOf = {QuestionPage.class, QuestionGroupPage.class})))
    @GetMapping("/questions")
    public Object list(
        @RequestParam(required = false) UUID batchId,
        @RequestParam(required = false) UUID transactionId,
        @RequestParam(required = false) QuestionStatus status,
        @RequestParam(defaultValue = "false") boolean grouped,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size
    ) {
        return grouped ? mockData.questionGroups() : mockData.questions();
    }

    @MockResponse
    @Operation(summary = "확인 질문 응답 및 부분 재판정",
        description = "PENDING 은 최초 답변, ANSWERED 는 정정(UserFact 새 version). 새 JudgmentRun 은 만들지 않는다. "
            + "처리 순서는 api.md 3.10")
    @ApiResponse(responseCode = "409", description = "QUESTION_NOT_ANSWERABLE, QUESTION_GROUP_MISMATCH",
        content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    @ApiResponse(responseCode = "422", description = "INVALID_ANSWER_VALUE, QUESTIONS_FROM_DIFFERENT_BATCHES",
        content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    @PostMapping("/question-responses")
    public QuestionAnswerResponse answer(@RequestBody QuestionAnswerRequest request) {
        return mockData.answer();
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
