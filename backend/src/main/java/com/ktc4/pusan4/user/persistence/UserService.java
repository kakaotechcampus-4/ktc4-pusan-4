package com.ktc4.pusan4.user.persistence;

import com.ktc4.pusan4.shared.UuidGenerator;
import com.ktc4.pusan4.shared.api.ApiException;
import com.ktc4.pusan4.user.domain.AppUser;
import com.ktc4.pusan4.user.domain.EmailCredential;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Locale;
import java.util.Optional;
import java.util.UUID;

@Service
public class UserService {

    private final AppUserRepository userRepository;
    private final UuidGenerator uuidGenerator;

    public UserService(AppUserRepository userRepository, UuidGenerator uuidGenerator) {
        this.userRepository = userRepository;
        this.uuidGenerator = uuidGenerator;
    }

    /**
     * 요청한 사용자를 찾는다. 인증은 통과했는데 사용자가 없으면(탈퇴 직후 남은 토큰 등)
     * 다시 로그인해야 하는 상태라 404 가 아니라 401 로 답한다.
     */
    @Transactional(readOnly = true)
    public AppUser get(UUID userId) {
        return userRepository.findById(userId)
            .map(AppUserEntity::toDomain)
            .orElseThrow(UserService::userNotFound);
    }

    /**
     * 회원 탈퇴 (api.md 3.1). 종속 데이터는 DB 가 함께 지운다(docs/architecture.md "삭제 정책").
     * 업로드(B4)가 잡는 사용자 행 잠금과 같은 행을 지우므로, 진행 중인 업로드가 끝난 뒤에 지워진다.
     * 이미 없는 사용자면 조회와 같이 401 이다.
     */
    @Transactional
    public void delete(UUID userId) {
        if (userRepository.deleteUser(userId) == 0) {
            throw userNotFound();
        }
    }

    /**
     * 이메일 계정을 만든다(api.md 1.1 회원가입). 이메일은 앞뒤 공백을 빼고 소문자로 저장한다.
     *
     * @param passwordHash BCrypt 해시. 원문을 넘기지 않는다
     * @return 새 사용자 id. 이미 가입한 이메일이면 empty
     */
    @Transactional
    public Optional<UUID> registerEmailAccount(String email, String passwordHash) {
        UUID id = uuidGenerator.generate();
        int inserted = userRepository.insertEmailAccount(id, normalizeEmail(email), passwordHash);
        return inserted == 1 ? Optional.of(id) : Optional.empty();
    }

    /** 이메일 로그인용. 없는 이메일이거나 비밀번호가 없는 계정이면 empty 다. */
    @Transactional(readOnly = true)
    public Optional<EmailCredential> findEmailCredential(String email) {
        return userRepository.findByEmail(normalizeEmail(email)).flatMap(AppUserEntity::emailCredential);
    }

    private static String normalizeEmail(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }

    static ApiException userNotFound() {
        return new ApiException(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "사용자를 찾을 수 없습니다.");
    }
}
