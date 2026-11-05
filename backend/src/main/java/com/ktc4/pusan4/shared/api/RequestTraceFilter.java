package com.ktc4.pusan4.shared.api;

import com.ktc4.pusan4.shared.UuidGenerator;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * 요청마다 traceId 를 만들어 MDC 와 응답 헤더 X-Trace-Id 에 넣고, 요청이 끝나면 요청 로그를 한 줄 남긴다.
 * 에러 본문의 traceId 도 이 값이라(ApiExceptionHandler) 사용자가 준 traceId 로 CloudWatch 에서 로그를 찾는다.
 *
 * <p>요청 로그 필드(method, path, status, durationMs)는 CloudWatch 메트릭 필터가 읽는 계약이다(docs/monitoring_plan.md).
 * path 에 쿼리스트링은 넣지 않고, 본문은 남기지 않는다. userId 는 인증을 거친 요청이면 MDC 로 붙는다(CurrentUserWebConfig).
 * actuator 는 healthcheck·지표 수집이 주기적으로 불러, 성공한 요청은 남기지 않는다. 실패는 남긴다.
 * DB 가 끊기면 health 가 503 이고, 사용자 요청이 없는 시간에는 이 줄이 5xx 알람을 울리는 유일한 신호다.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class RequestTraceFilter extends OncePerRequestFilter {

    public static final String TRACE_ID = "traceId";
    public static final String USER_ID = "userId";
    static final String TRACE_ID_HEADER = "X-Trace-Id";

    private static final Logger log = LoggerFactory.getLogger(RequestTraceFilter.class);

    private final UuidGenerator uuidGenerator;

    public RequestTraceFilter(UuidGenerator uuidGenerator) {
        this.uuidGenerator = uuidGenerator;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
        throws ServletException, IOException {
        String traceId = uuidGenerator.generate().toString();
        MDC.put(TRACE_ID, traceId);
        response.setHeader(TRACE_ID_HEADER, traceId);
        long started = System.nanoTime();
        int status = HttpServletResponse.SC_INTERNAL_SERVER_ERROR;
        try {
            chain.doFilter(request, response);
            status = response.getStatus();
        } finally {
            // 예외가 여기까지 올라오면 컨테이너가 500 으로 응답한다
            if (!isSuccessfulActuator(request, status)) {
                logRequest(request.getMethod(), request.getRequestURI(), status, (System.nanoTime() - started) / 1_000_000);
            }
            MDC.remove(TRACE_ID);
            MDC.remove(USER_ID);
        }
    }

    private static boolean isSuccessfulActuator(HttpServletRequest request, int status) {
        return request.getRequestURI().startsWith("/actuator") && status < 300;
    }

    private static void logRequest(String method, String path, int status, long durationMs) {
        log.atInfo()
            .addKeyValue("method", method)
            .addKeyValue("path", path)
            .addKeyValue("status", status)
            .addKeyValue("durationMs", durationMs)
            .log("{} {} {} {}ms", method, path, status, durationMs);
    }
}
