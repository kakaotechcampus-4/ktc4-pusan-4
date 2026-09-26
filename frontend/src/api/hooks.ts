import { useCallback, useEffect, useState } from 'react';

interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  /** 같은 요청을 다시 보낸다 (답변·수정 후 갱신용) */
  reload: () => void;
}

/**
 * api.* 호출을 화면에서 쓰기 위한 최소 훅. 캐시·중복 제거는 하지 않는다.
 * deps 가 바뀌면 다시 요청한다.
 */
export function useApi<T>(
request: () => Promise<T>,
deps: React.DependencyList = [])
: AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    request().
    then((result) => {
      if (cancelled) return;
      setData(result);
      setError(null);
    }).
    catch((err: Error) => {
      if (cancelled) return;
      setError(err);
    }).
    finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  const reload = useCallback(() => setTick((n) => n + 1), []);

  return { data, loading, error, reload };
}
