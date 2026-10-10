package com.ktc4.pusan4.user.persistence;

import com.ktc4.pusan4.shared.api.ApiException;
import com.ktc4.pusan4.user.domain.AppUser;
import org.junit.jupiter.api.Test;

import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.mock;

class UserServiceTest {

    private final AppUserRepository repository = mock(AppUserRepository.class);
    private final UserService userService = new UserService(repository);

    @Test
    void returns_user_when_present() {
        // given
        UUID userId = UUID.randomUUID();
        AppUser user = new AppUser(userId, "user@example.com", OffsetDateTime.parse("2026-09-01T10:00:00+09:00"));
        AppUserEntity entity = mock(AppUserEntity.class);
        given(entity.toDomain()).willReturn(user);
        given(repository.findById(userId)).willReturn(Optional.of(entity));

        // when / then
        assertThat(userService.get(userId)).isEqualTo(user);
    }

    @Test
    void missing_user_is_unauthorized_not_not_found() {
        // given: 인증은 통과했지만 사용자 행이 없다
        UUID userId = UUID.randomUUID();
        given(repository.findById(userId)).willReturn(Optional.empty());

        // when / then
        assertThatThrownBy(() -> userService.get(userId))
            .isInstanceOfSatisfying(ApiException.class, e -> {
                assertThat(e.getStatus().value()).isEqualTo(401);
                assertThat(e.getCode()).isEqualTo("UNAUTHORIZED");
            });
    }
}
