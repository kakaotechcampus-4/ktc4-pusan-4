package com.ktc4.pusan4.judgment.domain;

import java.util.List;

/**
 * 세무사에게 넘길 내보내기 한 행 (api.md 3.7 export). 거래의 현재 판정 하나와 그 거래에 답한 질문이다.
 *
 * @param allowedAmount 인정 금액. finalAmount 이고, 한도 항목이 있는 판정(접대비)은 그해 한도를 넘었으면 null 이다.
 *                      넘은 해의 거래별 인정액은 배분 순서로만 정해져 내보내지 않는다(#15)
 * @param answers       답한 질문. 같은 사실(factType)을 여러 revision 이 물었으면 하나만 둔다
 */
public record JudgmentExportRow(JudgmentRevision judgment, Long allowedAmount, List<Answer> answers) {

    public record Answer(String question, String answer) {
    }
}
