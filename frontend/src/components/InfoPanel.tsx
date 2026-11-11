import React from 'react';
import { Button } from './ui';

/** 제목 줄 오른쪽 그림 버튼(IconButton)의 여백. 36px 버튼이 제목 줄을 키우지 않고 오른쪽 끝이 본문 여백에 맞는다 */
export const PANEL_ICON = '-my-1.5 -mr-2.5';

/** 문장 속 링크와 같은 모양. 파랑은 주된 동작(판정 시작)에만 쓴다 */
export const PANEL_LINK =
'text-small font-bold text-ink underline decoration-accent-line underline-offset-4 transition-colors duration-150 hover:decoration-ink';

/**
 * 판정 전 확인과 내 정보가 입력 하나씩을 보여 주는 흰 상자. 회색 판 대신 괘선으로만 가른다 (11/5 치오 방향).
 * action 은 제목 줄 오른쪽의 그림 버튼 하나다 (문진 고치기, 다시 올리기)
 */
export function InfoPanel({ title, action, children }: {title: string;action?: React.ReactNode;children: React.ReactNode;}) {
  return (
    <section className="mt-6 overflow-hidden rounded-2xl border border-line">
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
        <h2 className="text-body font-bold text-ink">{title}</h2>
        {action}
      </div>
      {children}
    </section>);

}

export function InfoRows({ rows }: {rows: {term: string;value: string;}[];}) {
  return (
    <dl className="divide-y divide-line">
      {rows.map((row) =>
      <div key={row.term} className="flex gap-4 px-5 py-3">
          <dt className="w-36 shrink-0 text-small text-ink2">{row.term}</dt>
          <dd className="text-small tabular-nums text-ink">{row.value}</dd>
        </div>
      )}
    </dl>);

}

/** 읽는 중, 아직 없음 */
export function PanelNote({ children }: {children: React.ReactNode;}) {
  return <p className="px-5 py-4 text-small text-ink2">{children}</p>;
}

/** 못 읽은 것을 「없다」로 그리지 않는다 (C56, C57) */
export function PanelFailed({ onRetry, children }: {onRetry: () => void;children: React.ReactNode;}) {
  return (
    <div className="flex flex-wrap items-center gap-3 px-5 py-3">
      <p role="alert" className="text-small text-deny">{children}</p>
      <Button variant="secondary" size="sm" onClick={onRetry}>다시 시도</Button>
    </div>);

}
