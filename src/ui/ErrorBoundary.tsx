import { Component, type ErrorInfo, type ReactNode } from 'react';
import { errorMessage } from '@/core/errors';

interface Props {
  children: ReactNode;
}

interface State {
  error: unknown;
  stack?: string;
}

/**
 * Last-resort guard: a rendering bug must never leave a blank white screen.
 * Calculation errors are handled locally by the evaluator, not here.
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: unknown): State {
    return { error };
  }

  override componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error('OmniCalc render error', error, info.componentStack);
    this.setState(prev => ({ ...prev, stack: info.componentStack || undefined }));
  }

  private readonly reload = () => {
    window.location.reload();
  };

  private readonly reset = () => {
    this.setState({ error: null, stack: undefined });
  };

  override render(): ReactNode {
    const { error, stack } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="fatal" role="alert" style={{ padding: 24, maxWidth: 640, margin: '10vh auto' }}>
        <h1>Something went wrong</h1>
        <p className="fatal__message">{errorMessage(error)}</p>
        {stack ? (
          <details style={{ marginTop: 12, fontSize: 11, whiteSpace: 'pre-wrap', background: 'var(--bg-inset)', padding: 8, borderRadius: 8 }}>
            <summary>Component stack (for debugging)</summary>
            {stack}
          </details>
        ) : null}
        <div className="fatal__actions" style={{ marginTop: 16, display: 'flex', gap: 8 }}>
          <button type="button" className="btn btn--primary" onClick={this.reset}>
            Try again
          </button>
          <button type="button" className="btn" onClick={this.reload}>
            Reload app
          </button>
        </div>
        <p className="fatal__hint" style={{ marginTop: 12 }}>
          Your history and settings are stored on this device and are not affected.
        </p>
      </div>
    );
  }
}
