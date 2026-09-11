package com.ktc4.pusan4.shared;

import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class UuidV7GeneratorTest {

    @Test
    void generates_distinct_time_ordered_version_7_ids() {
        UuidV7Generator generator = new UuidV7Generator();

        List<UUID> generated = new ArrayList<>();
        for (int index = 0; index < 1_000; index++) {
            generated.add(generator.generate());
        }

        assertThat(generated)
            .allMatch(id -> id.version() == 7)
            .doesNotHaveDuplicates()
            .isSorted();
    }
}
