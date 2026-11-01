package com.ktc4.pusan4.auth;

import com.ktc4.pusan4.shared.auth.FixedUser;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.support.BeanDefinitionRegistry;
import org.springframework.beans.factory.support.RootBeanDefinition;
import org.springframework.boot.test.autoconfigure.web.servlet.MockMvcBuilderCustomizer;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.http.HttpHeaders;
import org.springframework.test.context.ContextConfigurationAttributes;
import org.springframework.test.context.ContextCustomizer;
import org.springframework.test.context.ContextCustomizerFactory;
import org.springframework.test.context.MergedContextConfiguration;
import org.springframework.test.web.servlet.setup.ConfigurableMockMvcBuilder;

import java.util.List;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

/**
 * 테스트의 자동 구성 MockMvc 요청에 고정 사용자의 액세스 토큰을 기본으로 싣는다.
 *
 * <p>{@code src/test/resources/META-INF/spring.factories} 로 모든 테스트 컨텍스트에 붙는다. 그래서 API 를 부르는
 * 테스트는 Authorization 을 직접 넣지 않아도 되고, 나중에 추가되는 테스트도 그대로 통과한다.
 * 요청에 Authorization 을 직접 넣으면 그 값을 쓴다. 컨텍스트에 {@link AccessTokens} 가 없으면(@WebMvcTest 에서
 * {@link TestAuthentication} 을 빠뜨린 경우) 아무것도 하지 않는다. 인증 자체를 보는 테스트는 이 기본값이 없는
 * MockMvc 를 직접 만든다(AuthIntegrationTest).
 */
public class DefaultBearerTokenContextCustomizerFactory implements ContextCustomizerFactory {

    @Override
    public ContextCustomizer createContextCustomizer(
        Class<?> testClass,
        List<ContextConfigurationAttributes> configAttributes
    ) {
        return new Customizer();
    }

    /** 모든 컨텍스트에 같은 것을 붙이므로 서로 같다고 해야 컨텍스트 캐시가 나뉘지 않는다. */
    private static final class Customizer implements ContextCustomizer {

        @Override
        public void customizeContext(ConfigurableApplicationContext context, MergedContextConfiguration config) {
            if (context instanceof BeanDefinitionRegistry registry) {
                registry.registerBeanDefinition("defaultBearerToken", new RootBeanDefinition(DefaultBearerToken.class));
            }
        }

        @Override
        public boolean equals(Object other) {
            return other instanceof Customizer;
        }

        @Override
        public int hashCode() {
            return Customizer.class.hashCode();
        }
    }

    static final class DefaultBearerToken implements MockMvcBuilderCustomizer {

        private final ObjectProvider<AccessTokens> accessTokens;

        DefaultBearerToken(ObjectProvider<AccessTokens> accessTokens) {
            this.accessTokens = accessTokens;
        }

        @Override
        public void customize(ConfigurableMockMvcBuilder<?> builder) {
            AccessTokens tokens = accessTokens.getIfAvailable();
            if (tokens == null) {
                return;
            }
            // 요청마다 새로 발급한다. 컨텍스트가 캐시돼 오래 살아도 15분 만료에 걸리지 않는다
            builder.defaultRequest(get("/").with(request -> {
                if (request.getHeader(HttpHeaders.AUTHORIZATION) == null) {
                    request.addHeader(HttpHeaders.AUTHORIZATION, "Bearer " + tokens.issue(FixedUser.ID));
                }
                return request;
            }));
        }
    }
}
