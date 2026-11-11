import { createContext, useContext, useEffect } from 'react';
import type { AssistantProposal } from '../../types/domain';

export interface ProposalEntry {
  proposal: AssistantProposal;
  /** 판정 수정의 Idempotency-Key. 카드마다 하나 */
  key: string;
  state: 'idle' | 'busy' | 'done' | 'failed';
  /** 적용한 뒤 카드 아래에 띄울 문장 */
  result?: string;
}

export interface ChatEntry {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  proposals: ProposalEntry[];
  /** 비서를 거치지 않고 화면이 답한 문답(도움말·다음 할 일). 비서에게 보내는 대화에서 뺀다 */
  local?: boolean;
  /** 답 아래의 다음 답 칩. 보고 있는 거래의 남은 질문 하나와 그 선택지다 */
  next?: NextAnswers;
}

/** 다음 답 칩의 재료. 칩을 누르면 그 값의 답 카드가 열리고, 사용자가 [적용]을 누른다 */
export interface NextAnswers {
  questionId: string;
  questionText: string;
  options: string[];
}

/** 끌어다 놓거나 행의 묻기 버튼으로 붙인 거래. 입력칸 위에 이름이 붙고, 비서는 이 거래를 보고 답한다 */
export interface Attached {
  transactionId: string;
  label: string;
}

/** 먼저 말 걸기. 한 번에 하나만, 닫을 수 있게 (FR-3·4) */
export interface Nudge {
  text: string;
  route?: string;
  actionLabel?: string;
}

export interface AssistantValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  entries: ChatEntry[];
  /** 답을 기다리는 중. 다음 할 일을 읽는 동안도 그렇다 — 그사이 다른 말을 넣으면 문답 순서가 섞인다 */
  pending: boolean;
  error: string | null;
  /** 입력 중인 글. 패널을 닫았다 열어도, 보내다 실패해도 남는다 */
  draft: string;
  setDraft: (draft: string) => void;
  send: (message: string) => Promise<void>;
  /** 도움말 주제. 비서를 부르지 않고 바로 답한다 */
  showHelp: (topicId: string) => void;
  /** 다음 할 일. 진행 상황 API 로 답한다 */
  showNext: () => Promise<void>;
  apply: (entryId: string, index: number) => Promise<void>;
  setSubject: (transactionId: string | null) => void;
  nudge: Nudge | null;
  /** once 를 주면 같은 값으로는 한 번만 띄운다 (판정 실행 하나에 한 번) */
  showNudge: (nudge: Nudge, once?: string) => void;
  dismissNudge: () => void;
  /** [적용]한 결과 문장. 몇 초 뒤 사라진다 */
  toast: string | null;
  attached: Attached | null;
  /** 붙인 거래를 뗀다. 비서는 더는 그 거래를 보고 있지 않다 */
  detach: () => void;
  /** 다음 답 칩을 눌렀다. 그 답의 카드를 그 답 아래에 연다 */
  pickNext: (entryId: string, value: string) => void;
}

export const AssistantContext = createContext<AssistantValue | null>(null);

export function useAssistant(): AssistantValue {
  const value = useContext(AssistantContext);
  if (!value) throw new Error('useAssistant must be used within AssistantProvider');
  return value;
}

/** 지금 보고 있는 거래를 비서에게 알린다 (FR-2). 화면을 떠나면 지운다 */
export function useAssistantSubject(transactionId: string | null) {
  const { setSubject } = useAssistant();
  useEffect(() => {
    setSubject(transactionId);
    return () => setSubject(null);
  }, [setSubject, transactionId]);
}
