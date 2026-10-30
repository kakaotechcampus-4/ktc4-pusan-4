package com.ktc4.pusan4.holiday;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.util.List;

/**
 * API 로 한 번도 받지 못한 해를 채울 공휴일. holiday/seed/{연도}.json 은 특일정보 API 응답을 그대로 저장한 것이라
 * API 로 받을 때와 같은 규칙(HolidayApiClient.parse)으로 읽는다. 다음 해는 그 해 응답을 같은 이름으로 저장해 덧붙인다.
 */
@Component
class HolidaySeed {

    private final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * @throws RuntimeException 파일이 응답 형식에 맞지 않을 때
     */
    List<PublicHoliday> holidays(int year) {
        ClassPathResource resource = new ClassPathResource("holiday/seed/" + year + ".json");
        if (!resource.exists()) {
            return List.of();
        }
        try (InputStream input = resource.getInputStream()) {
            return HolidayApiClient.parse(objectMapper.readTree(input), year);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
