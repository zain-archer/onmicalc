import { useEffect, useState } from 'react';
import { useOnlineStatus } from '@/pwa/status';
import { clearNotice, notifyStore } from '@/ui/notify';
import { useStore } from '@/storage/useStore';
import { canInstall, captureInstallPrompt, isStandalone, promptInstall, resetInstallPrompt } from '@/pwa/install';
import { initOfflineSupport } from '@/pwa/updates';

/** One-line status strip: offline notice, update prompt and install button. */
export function AppStatus() {
  const online = useOnlineStatus();
  const [updateReady, setUpdateReady] = useState<null | (() => void)>(null);
  const [installable, setInstallable] = useState(canInstall);
  const [installedAt] = useState(() => isStandalone());
  const [dismissed, setDismissed] = useState(false);
  const notice = useStore(notifyStore);

  useEffect(() => {
    const handle = initOfflineSupport({
      onUpdateReady: (apply) => setUpdateReady(() => apply),
    });
    return () => {
      // Nothing to tear down: the registration outlives the component by design.
      void handle;
    };
  }, []);

  useEffect(() => {
    const update = (event: Event) => {
      captureInstallPrompt(event);
      setInstallable(canInstall());
    };
    window.addEventListener('beforeinstallprompt', update);
    window.addEventListener('appinstalled', () => {
      resetInstallPrompt();
      setInstallable(false);
    });
    return () => window.removeEventListener('beforeinstallprompt', update);
  }, []);

  const hasNotice = notice.text.length > 0;
  if (online && !updateReady && !hasNotice && (!installable || dismissed)) return null;

  return (
    <div className="status-strip" role="status">
      {!online ? (
        <span className="status-strip__item status-strip__item--warn">
          Offline — the calculator, history and every tool keep working; nothing is sent anywhere.
        </span>
      ) : null}

      {updateReady ? (
        <span className="status-strip__item">
          A new version is ready.
          <button
            type="button"
            className="btn btn--small"
            onClick={() => {
              updateReady();
            }}
          >
            Reload
          </button>
        </span>
      ) : null}

      {installable && !dismissed ? (
        <span className="status-strip__item">
          Install OmniCalc for offline use.
          <button
            type="button"
            className="btn btn--small"
            onClick={() => {
              void promptInstall().then((outcome) => {
                setInstallable(canInstall());
                if (outcome !== 'accepted') setDismissed(true);
              });
            }}
          >
            Install
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--small"
            onClick={() => setDismissed(true)}
            aria-label="Dismiss the install suggestion"
          >
            ×
          </button>
        </span>
      ) : null}

      {installedAt ? <span className="status-strip__item status-strip__item--quiet">Running as an installed app.</span> : null}

      {hasNotice ? (
        <span
          className={`status-strip__item${notice.kind === 'error' ? ' status-strip__item--error' : notice.kind === 'ok' ? ' status-strip__item--ok' : ''}`}
        >
          {notice.text}
          <button
            type="button"
            className="btn btn--ghost btn--small"
            aria-label="Dismiss message"
            onClick={clearNotice}
          >
            ×
          </button>
        </span>
      ) : null}
    </div>
  );
}
