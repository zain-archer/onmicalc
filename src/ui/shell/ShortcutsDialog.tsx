import { SHORTCUTS, formatBinding } from '@/ui/shortcuts';
import { useFocusTrap } from '@/ui/useFocusTrap';

export interface ShortcutsDialogProps {
  open: boolean;
  onClose: () => void;
}

export function ShortcutsDialog({ open, onClose }: ShortcutsDialogProps) {
  const dialogRef = useFocusTrap<HTMLDivElement>(open);
  if (!open) return null;
  const isApple = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform ?? '');
  const groups = ['Global', 'Calculator', 'Panels'] as const;

  return (
    <div className="palette-backdrop" role="presentation" onClick={onClose}>
      <div
        ref={dialogRef}
        className="palette palette--dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="palette__title">Keyboard shortcuts</h2>
        {groups.map((group) => (
          <section key={group} className="palette__section">
            <h3>{group}</h3>
            <dl className="shortcuts">
              {SHORTCUTS.filter((shortcut) => shortcut.group === group).map((shortcut) => (
                <div key={shortcut.id} className="shortcuts__row">
                  <dt>{shortcut.label}</dt>
                  <dd>
                    <kbd>{formatBinding(shortcut, isApple)}</kbd>
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
        <button type="button" className="btn" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
