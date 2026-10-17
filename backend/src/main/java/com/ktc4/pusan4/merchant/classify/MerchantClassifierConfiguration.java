package com.ktc4.pusan4.merchant.classify;

import com.ktc4.pusan4.merchant.MerchantCategoryVocabulary;
import com.ktc4.pusan4.merchant.MerchantDictionaryRepository;
import com.ktc4.pusan4.merchant.normalize.NormalizeSpecLoader;
import com.ktc4.pusan4.merchant.normalize.T1Normalizer;
import com.ktc4.pusan4.merchant.pg.PgBlocklist;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.io.IOException;
import java.nio.file.Path;

/**
 * 분류기와 규칙 파일을 빈으로 등록한다.
 *
 * <p>규칙 파일은 기동할 때 한 번 읽는다. YAML 이 깨져 있으면 첫 업로드가 아니라 기동이 실패하게 하려는 것이다.
 * 경로는 {@code app.rules.dir} 이다. 로컬·테스트는 작업 디렉터리가 {@code backend/} 라 {@code ../rules},
 * 컨테이너는 {@code APP_RULES_DIR=/app/rules} 다({@code deploy/backend.Dockerfile}).
 */
@Configuration
class MerchantClassifierConfiguration {

    // Path 로 바로 받지 않는다. 스프링 PathEditor 는 '/' 로 시작하는 값을 웹 컨텍스트 리소스로 해석할 수 있다.
    private final Path rulesDirectory;

    MerchantClassifierConfiguration(@Value("${app.rules.dir}") String rulesDirectory) {
        this.rulesDirectory = Path.of(rulesDirectory);
    }

    @Bean
    T1Normalizer t1Normalizer() throws IOException {
        return new T1Normalizer(new NormalizeSpecLoader().load(rulesDirectory));
    }

    @Bean
    PgBlocklist pgBlocklist() throws IOException {
        return PgBlocklist.load(rulesDirectory);
    }

    @Bean
    KeywordRules keywordRules() throws IOException {
        return KeywordRules.load(rulesDirectory);
    }

    @Bean
    MerchantCategoryVocabulary merchantCategoryVocabulary() throws IOException {
        return MerchantCategoryVocabulary.load(rulesDirectory);
    }

    @Bean
    MerchantClassifier merchantClassifier(
            T1Normalizer normalizer,
            PgBlocklist pgBlocklist,
            KeywordRules keywordRules,
            MerchantDictionaryRepository merchantDictionaryRepository
    ) {
        return new RuleBasedMerchantClassifier(normalizer, pgBlocklist, keywordRules, merchantDictionaryRepository::findAll);
    }
}
