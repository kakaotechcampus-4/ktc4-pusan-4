package com.ktc4.pusan4.progress.domain;

import com.ktc4.pusan4.judgment.domain.JudgmentRunStatus;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class NextStepTest {

    @Test
    void follows_the_screen_order_and_stops_at_the_first_unfinished_step() {
        assertThat(NextStep.of(true, false, null, true)).isEqualTo(NextStep.CLASSIFY);
        assertThat(NextStep.of(false, false, null, false)).isEqualTo(NextStep.INTERVIEW);
        assertThat(NextStep.of(false, true, null, false)).isEqualTo(NextStep.CONFIRM);
        assertThat(NextStep.of(false, true, JudgmentRunStatus.FAILED, false)).isEqualTo(NextStep.CONFIRM);
        assertThat(NextStep.of(false, true, JudgmentRunStatus.QUEUED, false)).isEqualTo(NextStep.RESULTS);
        assertThat(NextStep.of(false, true, JudgmentRunStatus.RUNNING, true)).isEqualTo(NextStep.QUESTIONS);
        assertThat(NextStep.of(false, true, JudgmentRunStatus.COMPLETED, true)).isEqualTo(NextStep.QUESTIONS);
        assertThat(NextStep.of(false, true, JudgmentRunStatus.PARTIAL_FAILED, false)).isEqualTo(NextStep.RESULTS);
    }

    @Test
    void each_step_points_to_its_screen() {
        assertThat(NextStep.QUESTIONS.route()).isEqualTo("/questions");
        assertThat(NextStep.CLASSIFY.route()).isEqualTo("/preview");
        assertThat(NextStep.RESULTS.label()).isEqualTo("결과 보기");
    }

    @Test
    void never_points_to_the_run_screen_that_starts_a_new_run_without_an_id() {
        assertThat(NextStep.values()).extracting(NextStep::route).doesNotContain("/run");
    }
}
