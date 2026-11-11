// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { Highlighter } from './Highlighter';
import { highlightBus, proposalRefs, REF_ATTR } from './ask';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('제안이 바꿀 대상 표시', () => {
  it('제안 카드의 표지와 같은 낱말을 가진 요소에만 테두리를 두르고, 놓으면 지운다', async () => {
    document.body.innerHTML = `
      <section id="q1" ${REF_ATTR}="q:1 tx:a"></section>
      <section id="q2" ${REF_ATTR}="q:2 tx:b"></section>
      <div id="root"></div>`;
    const root = createRoot(document.getElementById('root') as HTMLElement);
    await act(async () => {
      root.render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Highlighter /></MemoryRouter>);
    });

    const refs = proposalRefs({ kind: 'answer', questionIds: ['2'], value: '업무용', source: 'ASSISTANT', card: '' });
    act(() => highlightBus.emit(refs));
    expect(document.getElementById('q1')?.classList.contains('ask-target')).toBe(false);
    expect(document.getElementById('q2')?.classList.contains('ask-target')).toBe(true);

    act(() => highlightBus.emit(null));
    expect(document.querySelectorAll('.ask-target')).toHaveLength(0);
    act(() => root.unmount());
  });

  it('화면 이동 제안은 바꿀 대상이 없다', () => {
    expect(proposalRefs({ kind: 'navigation', route: '/results', card: '' })).toEqual([]);
    expect(proposalRefs({ kind: 'override', judgmentId: 'j1', toVerdict: 'AVAILABLE', reason: '', card: '' })).toEqual(['j:j1']);
  });
});
