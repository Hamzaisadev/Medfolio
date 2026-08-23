import { Component, ErrorInfo, ReactNode } from 'react';
import { Logo } from '../ui/Logo';
import { AlertTriangleIcon, ChevronRightIcon, CheckIcon } from '../ui/icons';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  copied: boolean;
  showDetails: boolean;
}

const QUICK_LINKS = [
  { href: '/medicines', label: 'Schedule' },
  { href: '/timeline', label: 'Timeline' },
  { href: '/assistant', label: 'Assistant' },
  { href: '/settings', label: 'Settings' },
];

/**
 * Outermost render guard.
 *
 * Uses only CSS variable tokens, never the theme context: this sits above
 * ThemeProvider in the tree, so it has to survive without any provider — and it
 * still has to be readable in whichever theme the pre-hydration script applied.
 */
export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    copied: false,
    showDetails: false,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an exception:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleResetViewState = () => {
    try {
      sessionStorage.clear();
    } catch {
      // Blocked storage: navigating home is still worth attempting.
    }
    window.location.href = '/';
  };

  private handleCopyDiagnostics = async () => {
    const report = [
      '### Medfolio crash report',
      `- Timestamp: ${new Date().toISOString()}`,
      `- Page URL: ${window.location.href}`,
      `- User agent: ${navigator.userAgent}`,
      `- Error: ${this.state.error?.name || 'UnknownError'}`,
      `- Message: ${this.state.error?.message || 'No message provided'}`,
      '',
      '#### Component stack',
      '```',
      this.state.errorInfo?.componentStack || 'Not available',
      '```',
      '',
      '#### Stack trace',
      '```',
      this.state.error?.stack || 'Not available',
      '```',
    ].join('\n');

    try {
      await navigator.clipboard.writeText(report);
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2500);
    } catch (err) {
      console.warn('Failed to copy diagnostics:', err);
    }
  };

  public render() {
    if (!this.state.hasError) return this.props.children;

    const isDev = import.meta.env.DEV;

    return (
      <div className="min-h-[100dvh] bg-surface-sunken text-content font-sans flex flex-col">
        <header className="border-b border-line px-4 sm:px-6">
          <div className="max-w-2xl mx-auto h-16 flex items-center">
            <Logo size="md" />
          </div>
        </header>

        <main className="flex-1 flex items-center px-4 sm:px-6 py-10">
          <div className="max-w-2xl w-full mx-auto">
            <div className="rounded-[var(--radius-xl)] border border-line bg-surface-raised shadow-card p-6 sm:p-9">
              <div className="w-14 h-14 rounded-[var(--radius-lg)] bg-warn-bg border border-warn-border text-warn-text flex items-center justify-center">
                <AlertTriangleIcon size={26} />
              </div>

              <h1 className="mt-5 text-2xl sm:text-3xl font-bold tracking-tight">
                This screen stopped working
              </h1>
              {/* Deliberately scoped: a render crash says nothing about whether an
                  in-flight write completed, so this does not promise "zero data
                  loss" the way the previous copy did. */}
              <p className="mt-3 text-sm text-content-muted leading-relaxed">
                Something went wrong while drawing this page. Records you have already saved are
                unaffected. If you were part-way through entering something, check it after
                reloading.
              </p>

              <div className="mt-7 flex flex-col sm:flex-row gap-2.5">
                <button
                  type="button"
                  onClick={this.handleReload}
                  className="inline-flex items-center justify-center h-12 px-5 rounded-[var(--radius-md)] bg-accent text-content-onaccent text-sm font-semibold hover:bg-accent-hover active:scale-[0.98] transition-all shadow-card"
                >
                  Reload this page
                </button>
                <a
                  href="/"
                  className="inline-flex items-center justify-center h-12 px-5 rounded-[var(--radius-md)] border border-line bg-surface-raised text-content text-sm font-semibold hover:bg-surface-hover active:scale-[0.98] transition-all"
                >
                  Go to home
                </a>
                <button
                  type="button"
                  onClick={this.handleResetViewState}
                  className="inline-flex items-center justify-center h-12 px-4 rounded-[var(--radius-md)] text-sm font-medium text-content-muted hover:bg-surface-hover hover:text-content transition-colors"
                  title="Clears temporary view state, then returns home"
                >
                  Reset view state
                </button>
              </div>

              <div className="mt-7 pt-5 border-t border-line">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => this.setState((prev) => ({ showDetails: !prev.showDetails }))}
                    aria-expanded={this.state.showDetails}
                    className="text-xs font-semibold text-accent hover:underline flex items-center gap-1.5"
                  >
                    <ChevronRightIcon
                      size={14}
                      className={this.state.showDetails ? 'rotate-90 transition-transform' : 'transition-transform'}
                    />
                    {this.state.showDetails ? 'Hide technical details' : 'Show technical details'}
                  </button>

                  <button
                    type="button"
                    onClick={this.handleCopyDiagnostics}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-[var(--radius-sm)] border border-line text-content-muted hover:bg-surface-hover hover:text-content transition-colors"
                  >
                    {this.state.copied ? (
                      <>
                        <CheckIcon size={13} />
                        Copied
                      </>
                    ) : (
                      'Copy error report'
                    )}
                  </button>
                </div>

                {this.state.showDetails && (
                  <div className="mt-3 rounded-[var(--radius-md)] bg-surface-sunken border border-line p-4 font-mono text-xs text-content-muted space-y-2 animate-in fade-in-0">
                    <p className="font-bold text-risk-text break-all">
                      {this.state.error?.name || 'Error'}: {this.state.error?.message || 'Unknown'}
                    </p>
                    {isDev && this.state.error?.stack && (
                      <pre className="mt-1 overflow-x-auto max-h-48 p-2.5 rounded-[var(--radius-sm)] bg-surface leading-relaxed">
                        {this.state.error.stack}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            </div>

            <nav className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-content-muted">
              {QUICK_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="hover:text-accent transition-colors underline underline-offset-4"
                >
                  {link.label}
                </a>
              ))}
            </nav>
          </div>
        </main>

        {/* Emergency routing stays reachable even from a crashed screen. */}
        <footer className="border-t border-line px-4 sm:px-6 py-4">
          <p className="max-w-2xl mx-auto text-center text-xs text-content-muted">
            In a medical emergency, call{' '}
            <a href="tel:1122" className="font-bold text-risk-text hover:underline">
              1122
            </a>{' '}
            or go to your nearest emergency room.
          </p>
        </footer>
      </div>
    );
  }
}
