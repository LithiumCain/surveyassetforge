import { Component, ErrorInfo, ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { hasError: boolean };

// Catches any render-time crash in the app and shows a branded fallback instead
// of a blank white screen. Enterprise apps must never hard-fail to nothing.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // eslint-disable-next-line no-console
    console.error('[ui error]', error, info.componentStack);
    // TODO(sentry): forward to error monitoring once a DSN is configured.
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <main className="layout center">
          <div className="card" style={{ textAlign: 'center', maxWidth: 460 }}>
            <div className="topbar-logo" style={{ margin: '0 auto 12px' }}>SAF</div>
            <h2>Something went wrong</h2>
            <p className="subtle">
              An unexpected error occurred. Please reload the page — if it keeps happening, let us know.
            </p>
            <button style={{ marginTop: 16 }} onClick={() => window.location.reload()}>
              Reload
            </button>
          </div>
        </main>
      );
    }
    return this.props.children;
  }
}
