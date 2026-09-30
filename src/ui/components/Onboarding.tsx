import { useState, useEffect } from 'react';
import { useSettings } from '@/settings/useSettings';
import { settingsStore } from '@/settings/store';

export function Onboarding() {
  const settings = useSettings();
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!settings.onboardingCompleted && settings.showTips) {
      const timer = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(timer);
    }
  }, [settings.onboardingCompleted, settings.showTips]);

  const steps = [
    { title: 'Welcome to OmniCalc', text: 'Free, offline-first, private. 24 tools, no backend, no tracking.' },
    { title: 'Ask in plain English', text: 'Type "plot sin(x)" or "convert 50 mph to km/h" — OmniCalc picks the right tool.' },
    { title: 'Simple surface, powerful underneath', text: 'Beginner sees calculator. Expert gets CAS, graphing, matrices, physics, chemistry, 3D.' },
    { title: 'Keyboard & Touch', text: 'Ctrl+K for commands, / to search, Alt+↑↓ to walk tools, pinch to zoom graphs.' },
    { title: 'Your data stays here', text: 'History stored locally. Export anytime. Works offline. PWA installable.' },
  ];

  if (!visible) return null;

  const close = () => {
    settingsStore.set({ onboardingCompleted: true });
    setVisible(false);
  };

  return (
    <div className="palette-backdrop" role="presentation" style={{ zIndex: 100 }}>
      <div className="card" role="dialog" aria-modal="true" aria-label="Onboarding" style={{ maxWidth: 480, margin: '10vh auto', padding: 20 }}>
        <h2>{steps[step]!.title}</h2>
        <p className="muted">{steps[step]!.text}</p>
        <div className="row" style={{ marginTop: 16, justifyContent: 'space-between' }}>
          <span className="muted" style={{ fontSize: 12 }}>{step + 1} / {steps.length}</span>
          <div className="row">
            {step > 0 && <button className="btn btn--small" onClick={() => setStep(s => s - 1)}>Back</button>}
            {step < steps.length - 1 ? (
              <button className="btn btn--primary btn--small" onClick={() => setStep(s => s + 1)}>Next</button>
            ) : (
              <button className="btn btn--primary btn--small" onClick={close}>Get Started</button>
            )}
            <button className="btn btn--ghost btn--small" onClick={close}>Skip</button>
          </div>
        </div>
      </div>
    </div>
  );
}
