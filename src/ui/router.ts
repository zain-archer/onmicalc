import { useCallback, useEffect, useState } from 'react';
import { defaultRoute, getTool } from './tools';

/** Minimal hash router: works on static hosting with no server rewrites. */
export function readRoute(): string {
  if (typeof window === 'undefined') return defaultRoute();
  const hash = window.location.hash.replace(/^#\/?/, '').trim();
  return hash && getTool(hash)?.status === 'ready' ? hash : defaultRoute();
}

export function navigate(id: string): void {
  if (typeof window === 'undefined') return;
  window.location.hash = `#/${id}`;
}

export function useRoute(): [string, (id: string) => void] {
  const [route, setRoute] = useState<string>(readRoute);

  useEffect(() => {
    const onHashChange = () => setRoute(readRoute());
    window.addEventListener('hashchange', onHashChange);
    if (!window.location.hash) window.location.replace(`#/${defaultRoute()}`);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const go = useCallback((id: string) => navigate(id), []);
  return [route, go];
}
