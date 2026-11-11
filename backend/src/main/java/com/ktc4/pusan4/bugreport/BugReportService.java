package com.ktc4.pusan4.bugreport;

import com.ktc4.pusan4.shared.api.ApiException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.mail.MailException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.UUID;

/**
 * 서비스 안에서 받은 버그 신고를 팀 메일로 보낸다 (api.md 3.16). 저장하지 않는다.
 * 보내는 계정은 가입 인증 메일과 같은 spring.mail 이고, 받는 주소는 app.bug-report.to(기본은 보내는 계정)다.
 * 메일에는 사용자 id 와 신고 내용만 넣는다. 이메일 주소나 카드 데이터는 넣지 않는다.
 */
@Service
public class BugReportService {

    static final int PER_HOUR = 5;

    private static final Logger log = LoggerFactory.getLogger(BugReportService.class);
    private static final int SUBJECT_LENGTH = 50;
    private static final ZoneId KST = ZoneId.of("Asia/Seoul");
    private static final DateTimeFormatter TIME = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private final StringRedisTemplate redis;
    private final JavaMailSender mailSender;
    private final Clock clock;
    private final String from;
    private final String to;

    BugReportService(
        StringRedisTemplate redis,
        JavaMailSender mailSender,
        Clock clock,
        @Value("${spring.mail.username:}") String from,
        @Value("${app.bug-report.to:}") String to
    ) {
        this.redis = redis;
        this.mailSender = mailSender;
        this.clock = clock;
        this.from = from;
        this.to = to.isBlank() ? from : to;
    }

    public void report(UUID userId, String message, String pageUrl, String userAgent, String traceId) {
        if (from.isBlank()) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "BUG_REPORT_UNAVAILABLE",
                "지금은 버그 신고를 받을 수 없습니다. 메일로 보내 주세요.");
        }
        Instant now = clock.instant();
        countOrThrow(userId, now);
        SimpleMailMessage mail = new SimpleMailMessage();
        mail.setFrom(from);
        mail.setTo(to);
        mail.setSubject("[PreeT 버그 신고] " + subject(message));
        mail.setText("""
            사용자: %s
            시각: %s
            화면: %s
            브라우저: %s
            traceId: %s

            %s
            """.formatted(userId, TIME.format(now.atZone(KST)), orDash(pageUrl), orDash(userAgent), orDash(traceId),
            message.strip()));
        try {
            mailSender.send(mail);
        } catch (MailException e) {
            log.warn("버그 신고 메일을 보내지 못했다: {}", e.getMessage());
            throw new ApiException(HttpStatus.BAD_GATEWAY, "BUG_REPORT_SEND_FAILED",
                "신고를 보내지 못했습니다. 잠시 뒤 다시 시도해 주세요.");
        }
    }

    /** 사용자마다 한 시간(정시 기준)에 {@link #PER_HOUR}건. 서버가 여러 대여도 같은 값을 보도록 Redis 에 센다. */
    private void countOrThrow(UUID userId, Instant now) {
        long hour = now.getEpochSecond() / 3600;
        String key = "bug-report:" + userId + ":" + hour;
        Long count = redis.opsForValue().increment(key);
        if (count != null && count == 1) {
            redis.expire(key, Duration.ofHours(2));
        }
        if (count != null && count > PER_HOUR) {
            long minutes = Math.max(1, ((hour + 1) * 3600 - now.getEpochSecond() + 59) / 60);
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "BUG_REPORT_RATE_LIMITED",
                "%d분 뒤에 다시 보내 주세요.".formatted(minutes));
        }
    }

    /** 첫 줄만, 앞 50자. 줄바꿈이 제목 헤더에 들어가지 않는다. */
    private static String subject(String message) {
        String firstLine = message.strip().lines().findFirst().orElse("").strip();
        return firstLine.length() > SUBJECT_LENGTH ? firstLine.substring(0, SUBJECT_LENGTH) + "…" : firstLine;
    }

    private static String orDash(String value) {
        return value == null || value.isBlank() ? "-" : value;
    }
}
