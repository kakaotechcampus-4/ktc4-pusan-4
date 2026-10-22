package com.ktc4.pusan4.judgment.rule;

import com.ktc4.pusan4.judgment.domain.RuleSet;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.io.IOException;
import java.nio.file.Path;

/**
 * 기동할 때 규칙 카드를 한 번 읽는다. 읽거나 검증하지 못하면 부팅이 실패한다.
 * 규칙이 없는 서버가 떠서 모든 판정을 실패로 남기는 것보다 배포가 멈추는 편이 낫다.
 */
@Configuration
class RuleSetConfiguration {

    // 문자열로 받아 직접 Path 로 바꾼다. Path 로 바로 주입하면 Spring 이 리소스 경로로 해석해,
    // java -jar 로 띄울 때 상대 경로 "../rules" 를 변환하지 못하고 부팅이 실패한다(테스트에서는 드러나지 않는다).
    @Bean
    RuleSet ruleSet(@Value("${app.rules.dir}") String rulesDirectory) throws IOException {
        return new RuleCardLoader().load(Path.of(rulesDirectory));
    }
}
