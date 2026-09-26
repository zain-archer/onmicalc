import { APP_LICENSE, APP_NAME, APP_TAGLINE, APP_VERSION } from '@/version';

/** Keep About focused on the product; project progress and keyboard help live elsewhere. */
export function AboutPanel() {
  return (
    <div className="stack about-panel">
      <section className="card">
        <h2>
          {APP_NAME} <span className="pill">v{APP_VERSION}</span>
        </h2>
        <p>{APP_TAGLINE}. A free, offline-first calculator with no account, adverts or paid APIs.</p>
        <ul className="ticks">
          <li>Calculations run locally on your device.</li>
          <li>Your history, settings and files stay on this device.</li>
          <li>Open source under the {APP_LICENSE} licence.</li>
        </ul>
      </section>
      <section className="card">
        <h2>Privacy</h2>
        <p>
          OmniCalc does not require a network connection for its calculator tools. Imported files are
          processed locally and are not uploaded.
        </p>
      </section>
    </div>
  );
}
