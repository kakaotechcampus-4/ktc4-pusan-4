# 리프레시 토큰을 Redis 에 저장하고 폐기한다 (B9c)

- 브랜치: feature/refresh-token-redis
- 커밋: 46b93ba
- 주요파일: RedisRefreshTokenStore.java, SignedTokens.java, UserController.java, RedisRefreshTokenStoreIntegrationTest.java

## 한 일

- `RedisRefreshTokenStore` 로 `StatelessRefreshTokenStore` 를 바꿨다. 저장 규칙은 `docs/backend_api_plan.md` "저장소 결정"을 따랐다.
  - 토큰은 userId 와 로그인 단위 식별자(fid)를 담은 JWT 다. `SignedTokens` 에 클레임을 더 싣는 `issue` 와 클레임을 돌려주는 `verifyClaims` 를 더했다.
  - `refresh:{fid}` → userId·토큰 해시(SHA-256), `user:{userId}:families` → fid Set. 둘 다 TTL 은 리프레시 토큰 수명이다.
  - 재발급은 Lua 스크립트 하나로 해시를 비교해 바꾼다. 다르면 이미 쓴 토큰으로 보고 그 family 를 지운다.
  - 로그아웃은 그 family 만, `revokeAll` 은 Set 의 family 를 모두 지운다.
- 탈퇴(`DELETE /users/me`)는 `AuthService.logoutEverywhere` 로 로그인을 먼저 끊고 사용자를 지운다.
- api.md 1.1·탈퇴 절, backend README 인증 표를 고쳤다.

## 왜 이렇게 했나

- 탈퇴 순서: 사용자를 먼저 지우고 Redis 가 실패하면 지워진 사용자의 리프레시 토큰이 남는다. 로그인을 먼저 끊으면 Redis 가 실패할 때 탈퇴도 되지 않아 다시 시도하면 된다.
- 사용자 Set 의 TTL 을 로그인 때뿐 아니라 재발급 때도 늘렸다. 로그인 때만 늘리면 오래 쓰는 로그인이 Set 보다 오래 남아 탈퇴 때 지워지지 않는다.
- `StatelessRefreshTokenStore` 는 지웠다. 두 구현을 설정으로 고르게 둘 이유가 없다.

## 확인한 것

- `gradlew -p backend check` 통과(로컬, develop + #155·#166 을 합친 바탕 위).
- `RedisRefreshTokenStoreIntegrationTest`: 해시·TTL 저장, 재발급, 재사용 시 family 폐기, 로그아웃은 그 로그인만, `revokeAll` 은 그 사용자만, 만료·fid 없는 토큰·액세스 토큰 거부.
- `AuthIntegrationTest`: 재발급된 쿠키를 다시 쓰면 401 이고 새 쿠키도 끊긴다, 로그아웃한 쿠키는 401 이고 다른 로그인은 그대로다.

## 남은 것 · 아는 문제

- #148·#155·#166 이 develop 에 들어가면 99534fe 만 develop 위로 옮겨 PR 을 올린다.
- 탭 두 개가 같은 쿠키로 동시에 재발급하면 재사용으로 보여 그 로그인이 끊긴다. 프론트는 한 탭 안에서만 재발급을 하나로 묶는다.
- 배포하면 #155 방식(fid 없는) 리프레시 토큰은 모두 무효라 한 번 다시 로그인해야 한다.
