package com.ktc4.pusan4.user.domain;

import java.util.UUID;

/** 이메일 로그인에 쓰는 사용자 id 와 비밀번호 해시(BCrypt). */
public record EmailCredential(UUID userId, String passwordHash) {
}
