import { useEffect, useState } from 'react';

/** Online/offline tracking, so the UI can be honest about connectivity. */
export function currentOnlineStatus(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine !== false;
}

export function subscribeOnlineStatus(listener: (online: boolean) => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const onOnline = () => listener(true);
  const onOffline = () => listener(false);
  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);
  return () => {
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', onOffline);
  };
}

export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(currentOnlineStatus);
  useEffect(() => subscribeOnlineStatus(setOnline), []);
  return online;
}
