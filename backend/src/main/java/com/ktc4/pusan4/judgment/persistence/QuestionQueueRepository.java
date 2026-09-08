package com.ktc4.pusan4.judgment.persistence;

import org.springframework.data.repository.Repository;

import java.util.UUID;

interface QuestionQueueRepository extends Repository<QuestionQueueEntity, UUID> {

    QuestionQueueEntity save(QuestionQueueEntity question);
}
