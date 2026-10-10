package com.ktc4.pusan4.holiday;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

/**
 * 응답 샘플(src/test/resources/holiday)은 2026-10 실제 특일정보 API 응답이다.
 * 2025년 전체(20건), 2025년 12월(1건, item 이 객체), 2025년 11월(0건, items 가 빈 문자열).
 */
class HolidayApiClientTest {

    private static final String BASE_URL = "https://holiday.test/SpcdeInfoService";

    private MockRestServiceServer server;
    private HolidayApiClient client;

    @BeforeEach
    void setUp() {
        RestClient.Builder builder = RestClient.builder();
        server = MockRestServiceServer.bindTo(builder).build();
        client = new HolidayApiClient(builder, BASE_URL, "a+b/c=");
    }

    @Test
    void sends_the_key_fully_encoded_with_the_year() {
        server.expect(requestTo(BASE_URL
                + "/getRestDeInfo?serviceKey=a%2Bb%2Fc%3D&solYear=2025&numOfRows=100&_type=json"))
            .andRespond(json("rest-de-info-empty.json"));

        client.fetch(2025);

        server.verify();
    }

    @Test
    void reads_a_whole_year_and_merges_two_holidays_on_the_same_day() {
        server.expect(requestTo(org.hamcrest.Matchers.startsWith(BASE_URL)))
            .andRespond(json("rest-de-info-2025.json"));

        var holidays = client.fetch(2025);

        assertThat(holidays).hasSize(19)
            .contains(
                new PublicHoliday(LocalDate.of(2025, 10, 9), "한글날"),
                new PublicHoliday(LocalDate.of(2025, 6, 3), "임시공휴일(제21대 대통령 선거)"),
                new PublicHoliday(LocalDate.of(2025, 5, 5), "어린이날, 부처님오신날")
            );
    }

    @Test
    void reads_a_single_item_object() {
        server.expect(requestTo(org.hamcrest.Matchers.startsWith(BASE_URL)))
            .andRespond(json("rest-de-info-single.json"));

        assertThat(client.fetch(2025))
            .containsExactly(new PublicHoliday(LocalDate.of(2025, 12, 25), "기독탄신일"));
    }

    @Test
    void reads_empty_items_as_no_holidays() {
        server.expect(requestTo(org.hamcrest.Matchers.startsWith(BASE_URL)))
            .andRespond(json("rest-de-info-empty.json"));

        assertThat(client.fetch(2030)).isEmpty();
    }

    // 2026-10 실제 API 에 등록되지 않은 키로 보냈을 때의 응답이다.
    @Test
    void key_error_fails_with_its_message() {
        server.expect(requestTo(org.hamcrest.Matchers.startsWith(BASE_URL)))
            .andRespond(withStatus(HttpStatus.FORBIDDEN).contentType(MediaType.APPLICATION_JSON).body("""
                {"OpenAPI_ServiceResponse":{"cmmMsgHeader":{"errMsg":"SERVICE_KEY_IS_NOT_REGISTERED_ERROR",
                "returnAuthMsg":"등록되지 않은 서비스키","returnReasonCode":"30"}}}
                """));

        assertThatThrownBy(() -> client.fetch(2025))
            .hasMessageContaining("SERVICE_KEY_IS_NOT_REGISTERED_ERROR");
    }

    @Test
    void gateway_error_sent_as_200_fails_with_its_message() {
        server.expect(requestTo(org.hamcrest.Matchers.startsWith(BASE_URL)))
            .andRespond(withSuccess("""
                {"OpenAPI_ServiceResponse":{"cmmMsgHeader":{"errMsg":"SERVICE_KEY_IS_NOT_REGISTERED_ERROR",
                "returnAuthMsg":"등록되지 않은 서비스키","returnReasonCode":"30"}}}
                """, MediaType.APPLICATION_JSON));

        assertThatThrownBy(() -> client.fetch(2025))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("SERVICE_KEY_IS_NOT_REGISTERED_ERROR");
    }

    @Test
    void truncated_response_fails_instead_of_returning_fewer_holidays() {
        server.expect(requestTo(org.hamcrest.Matchers.startsWith(BASE_URL)))
            .andRespond(withSuccess("""
                {"response":{"header":{"resultCode":"00","resultMsg":"NORMAL SERVICE."},
                "body":{"items":{"item":{"dateKind":"01","dateName":"한글날","isHoliday":"Y","locdate":20251009,"seq":1}},
                "numOfRows":100,"pageNo":1,"totalCount":20}}}
                """, MediaType.APPLICATION_JSON));

        assertThatThrownBy(() -> client.fetch(2025))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("1 of 20");
    }

    @Test
    void configured_only_with_a_key() {
        assertThat(client.configured()).isTrue();
        assertThat(new HolidayApiClient(RestClient.builder(), BASE_URL, "").configured()).isFalse();
    }

    private static org.springframework.test.web.client.ResponseCreator json(String fixture) {
        return withSuccess(new ClassPathResource("holiday/" + fixture), MediaType.APPLICATION_JSON);
    }
}
