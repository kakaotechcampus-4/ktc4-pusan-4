package com.ktc4.pusan4.judgment.persistence;

import jakarta.persistence.MappedSuperclass;
import jakarta.persistence.PostLoad;
import jakarta.persistence.PostPersist;
import jakarta.persistence.Transient;
import org.springframework.data.domain.Persistable;

/**
 * id 를 저장 전에 직접 채우는 엔티티. Spring Data save() 는 id 가 있으면 기존 행으로 보고 merge 해서,
 * 새 행인데도 INSERT 전에 SELECT 를 한 번 더 보낸다. 막 만든 객체를 새 행으로 알려 바로 INSERT 하게 한다.
 *
 * <p>이미 있는 id 로 새 객체를 만들어 save() 하면 덮어쓰지 않고 키 중복으로 실패한다.
 */
@MappedSuperclass
abstract class AssignedIdEntity<ID> implements Persistable<ID> {

    @Transient
    private boolean persisted;

    @Override
    public boolean isNew() {
        return !persisted;
    }

    @PostLoad
    @PostPersist
    void markPersisted() {
        persisted = true;
    }
}
