/** Service-worker update detection: never reload the page without consent. */

export interface UpdateCallbacks {
  /** Called when a new version is downloaded and waiting to activate. */
  onUpdateReady?: (apply: () => void) => void;
}

export interface OfflineInitResult {
  supported: boolean;
  /** Force the waiting worker to activate and reload into the new version. */
  applyUpdate: () => void;
  /** Ask the browser to check for a new version now. */
  checkForUpdate: () => Promise<boolean>;
}

export function initOfflineSupport(callbacks: UpdateCallbacks = {}): OfflineInitResult {
  const noop = () => undefined;
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator) || import.meta.env?.DEV) {
    return { supported: false, applyUpdate: noop, checkForUpdate: async () => false };
  }

  let registration: ServiceWorkerRegistration | null = null;

  const applyUpdate = () => {
    const waiting = registration?.waiting;
    if (!waiting) {
      window.location.reload();
      return;
    }
    navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(), { once: true });
    waiting.postMessage('SKIP_WAITING');
  };

  const announce = (worker: ServiceWorker | null) => {
    if (!worker) return;
    callbacks.onUpdateReady?.(applyUpdate);
  };

  const start = async () => {
    try {
      const url = new URL('sw.js', document.baseURI).href;
      registration = await navigator.serviceWorker.register(url, { scope: './' });
      if (registration.waiting) announce(registration.waiting);
      registration.addEventListener('updatefound', () => {
        const installing = registration?.installing ?? null;
        installing?.addEventListener('statechange', () => {
          if (installing.state === 'installed' && navigator.serviceWorker.controller) {
            announce(installing);
          }
        });
      });
    } catch (error) {
      console.warn('OmniCalc: service worker registration failed', error);
    }
  };

  if (document.readyState === 'complete') void start();
  else window.addEventListener('load', () => void start(), { once: true });

  return {
    supported: true,
    applyUpdate,
    checkForUpdate: async () => {
      if (!registration) return false;
      await registration.update();
      return Boolean(registration.waiting);
    },
  };
}
