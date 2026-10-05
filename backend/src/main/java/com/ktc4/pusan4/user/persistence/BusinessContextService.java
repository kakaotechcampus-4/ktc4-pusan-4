package com.ktc4.pusan4.user.persistence;

import com.ktc4.pusan4.shared.UuidGenerator;
import com.ktc4.pusan4.shared.api.ApiException;
import com.ktc4.pusan4.user.domain.BusinessContext;
import com.ktc4.pusan4.user.domain.NewBusinessContext;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/**
 * 사업자 Context (api.md 3.2). 수정하지 않고 사용자별로 1 부터 버전을 올려 새 행을 만든다.
 */
@Service
public class BusinessContextService {

    private final AppUserRepository userRepository;
    private final UserContextRepository contextRepository;
    private final UuidGenerator uuidGenerator;

    public BusinessContextService(
        AppUserRepository userRepository,
        UserContextRepository contextRepository,
        UuidGenerator uuidGenerator
    ) {
        this.userRepository = userRepository;
        this.contextRepository = contextRepository;
        this.uuidGenerator = uuidGenerator;
    }

    /**
     * 새 버전을 만든다. 같은 사용자의 동시 요청이 같은 버전을 받지 않도록 사용자 행을 잠그고 채번한다.
     * 잠그지 않으면 UNIQUE(user_id, version) 위반이 500 으로 나간다.
     */
    @Transactional
    public BusinessContext create(UUID userId, NewBusinessContext input) {
        userRepository.findByIdForUpdate(userId).orElseThrow(UserService::userNotFound);
        int version = contextRepository.findLatestVersion(userId) + 1;
        return contextRepository.save(new UserContextEntity(uuidGenerator.generate(), userId, version, input))
            .toDomain();
    }

    @Transactional(readOnly = true)
    public BusinessContext current(UUID userId) {
        return contextRepository.findFirstByUserIdOrderByVersionDesc(userId)
            .map(UserContextEntity::toDomain)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "CONTEXT_NOT_FOUND", "문진 전입니다."));
    }

    @Transactional(readOnly = true)
    public List<BusinessContext> history(UUID userId) {
        return contextRepository.findByUserIdOrderByVersionAsc(userId).stream()
            .map(UserContextEntity::toDomain)
            .toList();
    }
}
