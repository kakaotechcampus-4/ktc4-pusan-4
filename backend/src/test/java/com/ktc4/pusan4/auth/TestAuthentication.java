package com.ktc4.pusan4.auth;

import com.ktc4.pusan4.shared.TimeConfiguration;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Import;

/**
 * {@code @WebMvcTest} 는 컨트롤러·WebMvcConfigurer 만 올려서, 요청마다 사용자를 확인하는 인터셉터가 쓸 빈이 없다.
 * 이 설정을 {@code @Import} 하면 실제 Bearer 검증이 붙고, 기본 토큰({@link DefaultBearerTokenContextCustomizerFactory})도 실린다.
 * {@code @SpringBootTest} 에는 필요 없다.
 */
@TestConfiguration
@Import({TimeConfiguration.class, AuthConfiguration.class, AccessTokens.class, BearerCurrentUserProvider.class})
public class TestAuthentication {
}
