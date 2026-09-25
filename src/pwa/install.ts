/** Install-prompt plumbing for the PWA (progressive enhancement only). */

export interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice?: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferredPrompt: InstallPromptEvent | null = null;

export function captureInstallPrompt(event: Event): void {
  const candidate = event as InstallPromptEvent;
  if (typeof candidate.prompt !== 'function') return;
  event.preventDefault?.();
  deferredPrompt = candidate;
}

export function canInstall(): boolean {
  return deferredPrompt !== null;
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const media = typeof matchMedia === 'function' ? matchMedia('(display-mode: standalone)').matches : false;
  const iosStandalone = Boolean((window.navigator as { standalone?: boolean }).standalone);
  return media || iosStandalone;
}

/** Shows the browser install prompt; resolves with the user's decision. */
export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferredPrompt) return 'unavailable';
  const prompt = deferredPrompt;
  deferredPrompt = null;
  await prompt.prompt();
  try {
    const choice = await prompt.userChoice;
    return choice?.outcome ?? 'dismissed';
  } catch {
    return 'dismissed';
  }
}

/** Test helper: forget any captured prompt. */
export function resetInstallPrompt(): void {
  deferredPrompt = null;
}
