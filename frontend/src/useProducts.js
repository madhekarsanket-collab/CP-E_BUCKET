import { useCallback, useEffect, useRef, useState } from 'react';

import { api, errorMessage } from './api';
import { useToast } from './context/ToastContext';

/**
 * Loads the product list for `buildUrl(offset)` and supports "show more" and retry.
 * `buildUrl` must change identity whenever the filters change; that is what discards stale responses.
 */
export function useProducts(buildUrl) {
  const toast = useToast();
  const [result, setResult] = useState({ items: [], total: 0 });
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const currentBuildUrl = useRef(buildUrl);
  currentBuildUrl.current = buildUrl;

  useEffect(() => {
    let isCurrent = true;
    setStatus('loading');
    api(buildUrl(0))
      .then((data) => { if (isCurrent) { setResult(data); setStatus('ready'); } })
      .catch((e) => { if (isCurrent) { setError(errorMessage(e)); setStatus('error'); } });
    return () => { isCurrent = false; };
  }, [buildUrl, attempt]);

  const loadMore = useCallback(async () => {
    const requestedFor = buildUrl;
    setIsLoadingMore(true);
    try {
      const more = await api(buildUrl(result.items.length));
      if (currentBuildUrl.current !== requestedFor) return; // filters changed while this was loading
      setResult((current) => ({ items: [...current.items, ...more.items], total: more.total }));
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setIsLoadingMore(false);
    }
  }, [buildUrl, result.items.length, toast]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  return { result, status, error, isLoadingMore, loadMore, retry };
}
