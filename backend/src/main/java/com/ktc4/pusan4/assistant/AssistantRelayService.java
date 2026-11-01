package com.ktc4.pusan4.assistant;

import com.ktc4.pusan4.assistant.api.ChatRequest;
import com.ktc4.pusan4.assistant.api.ChatResponse;
import com.ktc4.pusan4.transaction.persistence.TransactionService;
import com.ktc4.pusan4.transaction.persistence.UploadBatchService;
import org.springframework.stereotype.Service;

import java.util.UUID;

/**
 * 비서 대화 중계 (api.md 3.14). 인증은 앞단 인터셉터가 했다. 여기서는 맥락의 업로드·거래가 요청한 사용자의 것인지 보고,
 * 사용자별 한도를 센 뒤 AI 서버로 넘긴다. 대화 기록은 저장하지 않는다(C-12).
 */
@Service
public class AssistantRelayService {

    private final UploadBatchService batchService;
    private final TransactionService transactionService;
    private final AssistantRateLimiter rateLimiter;
    private final AssistantClient client;

    AssistantRelayService(
        UploadBatchService batchService,
        TransactionService transactionService,
        AssistantRateLimiter rateLimiter,
        AssistantClient client
    ) {
        this.batchService = batchService;
        this.transactionService = transactionService;
        this.rateLimiter = rateLimiter;
        this.client = client;
    }

    public ChatResponse chat(UUID userId, String authorization, ChatRequest request) {
        // 남의 ID 를 프롬프트 맥락에 싣지 않는다. 남의 것은 없는 것과 같은 404 다. 한도는 세지 않는다.
        ChatRequest.Context context = request.context();
        if (context != null && context.batchId() != null) {
            batchService.get(userId, context.batchId());
        }
        if (context != null && context.transactionId() != null) {
            transactionService.get(userId, context.transactionId());
        }
        try (AssistantRateLimiter.Lease ignored = rateLimiter.acquire(userId)) {
            return client.chat(authorization, request);
        }
    }
}
