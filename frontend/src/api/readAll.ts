import type { Judgment, Page } from '../types/domain';
import type { Api } from './contract';
import { awaitingOf } from '../utils/verdict';

/** 서버가 한 쪽에 주는 최대 행 수 */
const MAX_PAGE_SIZE = 100;

/** 쪽을 끝까지 읽어 한 배열로 모은다. 한 쪽(100개)만 읽으면 그 밖의 행이 말없이 빠진다 */
export async function readAll<T>(fetchPage: (page: number, size: number) => Promise<Page<T>>): Promise<T[]> {
  const all: T[] = [];
  for (let page = 0;; page += 1) {
    const result = await fetchPage(page, MAX_PAGE_SIZE);
    all.push(...result.items);
    if (!result.page.hasNext || page + 1 >= result.page.totalPages) return all;
  }
}

export interface UnavailableSplit {
  /** 답을 기다리는 질문이 없는 불가 */
  confirmed: Judgment[];
  /** 답변 대기. 불가 가운데 답을 기다리는 질문이 걸린 거래 (C12) */
  awaiting: Judgment[];
  /** 답을 기다리는 질문이 걸린 거래 전부. 판정과 상관없이 행의 표지에 쓴다 */
  pendingTransactionIds: Set<string>;
}

/**
 * 불가를 답변 대기와 나머지로 가른다. 답변 대기는 판정이 아니라 불가에 붙는 표지라 서버 필터가 없어서,
 * 불가 판정과 답을 기다리는 질문을 둘 다 끝까지 읽어 화면에서 가른다.
 * scope 는 판정을 읽을 범위(업로드나 실행), questionBatchId 는 질문을 읽을 업로드다
 */
export async function readUnavailableSplit(
api: Pick<Api, 'judgments' | 'questions'>,
scope: {batchId: string;} | {runId: string;},
questionBatchId: string)
: Promise<UnavailableSplit> {
  const [unavailable, pending] = await Promise.all([
  readAll((page, size) => api.judgments.list({ ...scope, verdict: 'UNAVAILABLE', page, size })),
  readAll((page, size) => api.questions.list({ batchId: questionBatchId, status: 'PENDING', page, size }))]
  );
  const pendingTransactionIds = new Set(pending.map((question) => question.transactionId));
  const awaiting = awaitingOf(unavailable, pendingTransactionIds);
  const awaitingSet = new Set(awaiting);
  return {
    confirmed: unavailable.filter((judgment) => !awaitingSet.has(judgment)),
    awaiting,
    pendingTransactionIds
  };
}
