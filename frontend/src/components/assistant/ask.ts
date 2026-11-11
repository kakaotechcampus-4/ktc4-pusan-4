import type { AssistantProposal } from '../../types/domain';

/**
 * 화면이 Really 를 부르는 길. Really 버튼을 끌어 놓거나 행의 묻기 버튼을 누르면 무엇에 대해 묻는지를 실어 보낸다.
 *
 * 지금 비서 API 가 화면에서 받는 것은 보고 있는 거래(context.transactionId) 하나다. 그래서
 * - 거래는 그 거래를 보고 있는 거래로 삼아 묻는다. 패널 입력칸 위에 이름이 붙는다
 * - 금액 판, 한도, 근거 조문, 판정 이유는 무엇을 물을지 입력칸에 미리 적어 준다. 화면 글을 그대로 옮기지 않고
 *   정해 둔 문장만 쓴다. 비서는 대화의 사용자 말을 제안의 근거로 쓰기 때문이다(ai/assistant/agent.py)
 */
export type AskTarget =
{kind: 'transaction';transactionId: string;label: string;} |
{kind: 'statute';transactionId: string | null;label: string;} |
{kind: 'reason';transactionId: string;label: string;} |
{kind: 'summary';} |
{kind: 'limit';};

/** 놓을 수 있는 요소에 붙이는 속성. 값은 AskTarget 의 JSON 이다 */
export const ASK_ATTR = 'data-ask';

export const askProps = (target: AskTarget) => ({ [ASK_ATTR]: JSON.stringify(target) });

export function askTargetOf(element: Element | null): {element: HTMLElement;target: AskTarget;} | null {
  const found = element?.closest<HTMLElement>(`[${ASK_ATTR}]`);
  if (!found) return null;
  try {
    return { element: found, target: JSON.parse(found.getAttribute(ASK_ATTR) ?? '') as AskTarget };
  } catch {
    return null;
  }
}

/** 놓을 곳 위에 띄우는 말 */
export const ASK_LABEL: Record<AskTarget['kind'], string> = {
  transaction: '이 거래 묻기',
  statute: '이 조문 묻기',
  reason: '이 이유 묻기',
  summary: '이 금액 묻기',
  limit: '이 한도 묻기'
};

/** 입력칸에 미리 적는 질문. 보내기 전에 고칠 수 있다 */
export const ASK_DRAFT: Record<Exclude<AskTarget['kind'], 'transaction'>, string> = {
  statute: '이 거래의 근거 조문을 쉽게 풀어 주세요.',
  reason: '이 거래의 판정 이유를 쉽게 풀어 주세요.',
  // 앞서 거래 하나를 물었으면 「경비 가능 금액」만으로는 그 거래의 금액으로 읽힌다(11/11). 업로드 전체라고 적는다
  summary: '이 업로드 전체의 경비 가능 금액은 어떻게 나왔나요?',
  limit: '접대비 한도는 어떻게 정해졌나요?'
};

type Listener<T> = (value: T) => void;

function bus<T>() {
  const listeners = new Set<Listener<T>>();
  return {
    emit: (value: T) => listeners.forEach((listener) => listener(value)),
    subscribe: (listener: Listener<T>) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    }
  };
}

/** 화면 → Really. 패널을 열고 무엇을 묻는지 붙인다 */
export const askBus = bus<AskTarget>();

/**
 * Really 제안 카드 → 화면. 카드에 마우스를 올리면 그 제안이 바꿀 행이나 질문에 테두리를 두른다.
 * 값은 바뀔 대상의 표지(REF_ATTR 의 낱말)이고 null 이면 지운다
 */
export const highlightBus = bus<string[] | null>();

/** 바뀔 수 있는 대상에 붙이는 표지. 공백으로 나눈 낱말이다: tx:<거래 id> j:<판정 id> q:<질문 id> r:<분류 검토 id> */
export const REF_ATTR = 'data-ref';

/** 제안 카드가 바꿀 대상의 표지(REF_ATTR 의 낱말). 화면 이동은 바꿀 것이 없다 */
export function proposalRefs(proposal: AssistantProposal): string[] {
  switch (proposal.kind) {
    case 'answer':
      return proposal.questionIds.map((id) => `q:${id}`);
    case 'bulk_answer':
      return [`ft:${proposal.factType}`];
    case 'classification':
      return proposal.reviewIds.map((id) => `r:${id}`);
    case 'override':
      return [`j:${proposal.judgmentId}`];
    case 'handoff_note':
      return proposal.transactionIds.map((id) => `tx:${id}`);
    case 'navigation':
      return [];
  }
}
