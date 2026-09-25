import { Component, type ErrorInfo, type ReactNode } from 'react';
import { errorMessage } from '@/core/errors';

interface Props {
  children: ReactNode;
}

interface State {
  error: unknown;
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
    // Kept intentionally: this is the only place a fatal render error is logged.
    console.error('OmniCalc render error', error, info.componentStack);
  }

  private readonly reload = () => {
    window.location.reload();
  };

  private readonly reset = () => {
    this.setState({ error: null });
  };

  override render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="fatal" role="alert">
        <h1>Something went wrong</h1>
        <p className="fatal__message">{errorMessage(error)}</p>
        <div className="fatal__actions">
          <button type="button" className="btn btn--primary" onClick={this.reset}>
            Try again
          </button>
          <button type="button" className="btn" onClick={this.reload}>
            Reload app
          </button>
        </div>
        <p className="fatal__hint">
          Your history and settings are stored on this device and are not affected.
        </p>
      </div>
    );
  }
}
