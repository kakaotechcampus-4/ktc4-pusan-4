package com.ktc4.pusan4.judgment.domain;

import java.util.List;

/**
 * 세무사에게 넘길 내보내기 한 행 (api.md 3.7 export). 거래의 현재 판정 하나와 그 거래에 답한 질문이다.
 *
 * @param allowedAmount 한도까지 반영한 인정 금액. 한도 항목이 있는 판정(접대비)은 한도 인정액, 아니면 finalAmount 다.
 *                      현재 결과 요약(3.7 summary)과 같은 기준이다
 * @param answers       답한 질문. 같은 사실(factType)을 여러 revision 이 물었으면 하나만 둔다
 */
public record JudgmentExportRow(JudgmentRevision judgment, Long allowedAmount, List<Answer> answers) {

    public record Answer(String question, String answer) {
    }
}
