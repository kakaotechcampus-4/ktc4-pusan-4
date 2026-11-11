import { useEffect, useState } from 'react';
import { draftCard, type DraftState } from './impact';

/** YAML 해석기는 관리자 화면에서만 쓴다. 처음 쓸 때 한 번 받는다 */
let parser: Promise<typeof import('yaml')> | null = null;
const loadParser = () => parser ??= import('yaml');

/**
 * 후보의 초안 YAML 을 읽어 관문, 판정, 인용을 꺼낸다. 못 읽으면 error 다(알리기만 하고 승인은 막지 않는다).
 * 해석기를 받지 못한 것도 error 로 본다
 */
export function useDraft(yaml: string | null): DraftState {
  const [state, setState] = useState<DraftState>(yaml === null ? { status: 'none' } : { status: 'loading' });

  useEffect(() => {
    if (yaml === null) {
      setState({ status: 'none' });
      return;
    }
    let cancelled = false;
    setState({ status: 'loading' });
    loadParser().
    then(({ parse }) => {
      if (cancelled) return;
      const card = draftCard(parse(yaml));
      setState(card ? { status: 'ok', card } : { status: 'error' });
    }).
    catch(() => {
      if (!cancelled) setState({ status: 'error' });
    });
    return () => {
      cancelled = true;
    };
  }, [yaml]);

  return state;
}
