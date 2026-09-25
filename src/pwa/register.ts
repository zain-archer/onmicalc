import { initOfflineSupport } from './updates';
import { subscribeOnlineStatus } from './status';
import { captureInstallPrompt } from './install';

/**
 * Registers the service worker (offline support), install-prompt capture and
 * connectivity tracking. All of it is progressive enhancement: if anything is
 * unavailable the app keeps working exactly as before.
 */
export function registerServiceWorker(): void {
  if (typeof window === 'undefined') return;
  window.addEventListener('beforeinstallprompt', captureInstallPrompt);
  subscribeOnlineStatus(() => undefined);
  initOfflineSupport();
}
