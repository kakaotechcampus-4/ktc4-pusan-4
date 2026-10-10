package com.ktc4.pusan4.user.persistence;

import com.ktc4.pusan4.shared.api.ApiException;
import com.ktc4.pusan4.user.domain.AppUser;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
public class UserService {

    private final AppUserRepository userRepository;

    public UserService(AppUserRepository userRepository) {
        this.userRepository = userRepository;
    }

    /**
     * 요청한 사용자를 찾는다. 인증은 통과했는데 사용자가 없으면(탈퇴 직후 남은 토큰 등)
     * 다시 로그인해야 하는 상태라 404 가 아니라 401 로 답한다.
     */
    @Transactional(readOnly = true)
    public AppUser get(UUID userId) {
        return userRepository.findById(userId)
            .map(AppUserEntity::toDomain)
            .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "사용자를 찾을 수 없습니다."));
    }
}
