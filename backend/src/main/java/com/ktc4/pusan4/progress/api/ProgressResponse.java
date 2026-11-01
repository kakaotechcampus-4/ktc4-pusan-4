package com.ktc4.pusan4.progress.api;

import com.ktc4.pusan4.judgment.domain.JudgmentRunStatus;
import com.ktc4.pusan4.progress.persistence.ProgressService.Progress;
import com.ktc4.pusan4.shared.api.Coded;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.UUID;

/** 진행 상황 (api.md 3.14). */
public record ProgressResponse(
    Batch batch,
    @Schema(description = "최신 문진. 문진 전이면 null. 수입금액은 담지 않는다") Context context,
    Classification classification,
    @Schema(description = "이 업로드의 최근 판정 실행. 실행한 적 없으면 null") Run run,
    Questions questions,
    Next next
) {

    private static final DateTimeFormatter MONTH = DateTimeFormatter.ofPattern("yyyy-MM");

    public record Batch(UUID id, @Schema(example = "국민 · 2026-09") String label, long transactionCount) {
    }

    public record Context(int version, @Schema(example = "복식부기") String bookkeeping, boolean hasEmployee) {
    }

    public record Classification(long pendingCount, long pendingAmount) {
    }

    public record Run(UUID id, Coded<JudgmentRunStatus> status) {
    }

    public record Questions(
        int pendingCount,
        long pendingAmount,
        @Schema(description = "지난번 답이 A등급이고 값이 있는 그룹의 질문 수") int fillableFromPrevious
    ) {
    }

    public record Next(
        @Schema(allowableValues = {"CLASSIFY", "INTERVIEW", "CONFIRM", "QUESTIONS", "RESULTS"}) String step,
        String route,
        String label
    ) {
    }

    static ProgressResponse from(Progress progress) {
        var batch = progress.batch();
        var context = progress.context();
        var run = progress.run();
        return new ProgressResponse(
            new Batch(batch.id(), label(batch.cardIssuer(), batch.periodStart(), batch.periodEnd()),
                batch.transactionCount()),
            context == null ? null
                : new Context(context.version(), context.bookkeepingDuty().name(), context.hasEmployee()),
            new Classification(progress.classification().count(), progress.classification().amount()),
            run == null ? null : new Run(run.id(), runStatus(run.status())),
            new Questions(progress.questions().count(), progress.questions().amount(), progress.fillableFromPrevious()),
            new Next(progress.next().name(), progress.next().route(), progress.next().label())
        );
    }

    /** 「국민 · 2026-09」. 여러 달이면 「국민 · 2026-01~2026-03」. */
    static String label(String cardIssuer, LocalDate start, LocalDate end) {
        String months = start.withDayOfMonth(1).equals(end.withDayOfMonth(1))
            ? MONTH.format(start)
            : MONTH.format(start) + "~" + MONTH.format(end);
        return cardIssuer + " · " + months;
    }

    /** 화면 문구는 api.md 2.7 을 따른다(JudgmentRunResponse 와 같다). */
    private static Coded<JudgmentRunStatus> runStatus(JudgmentRunStatus status) {
        String label = switch (status) {
            case QUEUED -> "대기";
            case RUNNING -> "실행 중";
            case COMPLETED -> "완료";
            case PARTIAL_FAILED -> "부분 실패";
            case FAILED -> "전체 실패";
        };
        return new Coded<>(status, label);
    }
}
