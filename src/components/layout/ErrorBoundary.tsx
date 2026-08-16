import { Component, ErrorInfo, ReactNode } from 'react';
import { Logo } from '../ui/Logo';

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
    console.error('Clinical ErrorBoundary caught an exception:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  private handleResetCacheAndReload = () => {
    try {
      sessionStorage.clear();
    } catch {
      // ignore
    }
    window.location.href = '/';
  };

  private handleCopyDiagnostics = async () => {
    const report = [
      '### 🩺 Medfolio Clinical Crash Diagnostic Report',
      `- **Timestamp:** ${new Date().toISOString()}`,
      `- **Page URL:** ${window.location.href}`,
      `- **User Agent:** ${navigator.userAgent}`,
      `- **Error Name:** ${this.state.error?.name || 'UnknownError'}`,
      `- **Error Message:** ${this.state.error?.message || 'No message provided'}`,
      '',
      '#### Component Stack:',
      '```',
      this.state.errorInfo?.componentStack || 'No component stack available',
      '```',
      '',
      '#### Error Stack Trace:',
      '```',
      this.state.error?.stack || 'No JS stack trace',
      '```',
    ].join('\n');

    try {
      await navigator.clipboard.writeText(report);
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2500);
    } catch (err) {
      console.warn('Failed to copy to clipboard:', err);
    }
  };

  public render() {
    if (this.state.hasError) {
      const isDev = import.meta.env.DEV;

      return (
        <div className="min-h-screen bg-linear-to-b from-slate-950 via-ink-950 to-slate-900 text-ink-100 flex flex-col justify-between p-4 sm:p-6 lg:p-8 font-sans selection:bg-teal-500 selection:text-white">
          {/* Header Bar */}
          <div className="max-w-4xl w-full mx-auto flex items-center justify-between py-2 border-b border-white/10">
            <div className="flex items-center gap-2">
              <Logo size="md" />
              <span className="text-[11px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30">
                Safe Recovery Mode
              </span>
            </div>
            <span className="text-xs text-ink-400 font-mono hidden sm:inline-block">
              Status: View Protected
            </span>
          </div>

          {/* Main Error Card */}
          <div className="max-w-2xl w-full mx-auto my-auto py-8">
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 sm:p-10 shadow-2xl relative overflow-hidden">
              {/* Subtle ambient medical glow */}
              <div className="absolute -top-24 -right-24 w-64 h-64 bg-teal-500/15 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

              {/* Status Header */}
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="relative">
                  <div className="w-16 h-16 rounded-2xl bg-linear-to-br from-amber-500/20 to-teal-500/20 border border-amber-400/30 flex items-center justify-center text-amber-300 shadow-lg shadow-amber-500/10">
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.75"
                        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                      />
                    </svg>
                  </div>
                  <span className="absolute -bottom-1 -right-1 w-5 h-5 bg-teal-500 text-slate-950 rounded-full flex items-center justify-center text-[10px] font-black shadow-xs">
                    ✓
                  </span>
                </div>

                <div className="space-y-1.5">
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                    Screen Paused for Safety
                  </h1>
                  <p className="text-sm sm:text-base text-ink-300 max-w-md mx-auto leading-relaxed">
                    Medfolio encountered a rendering interruption on this page. Your medical database and personal records remain intact and secure.
                  </p>
                </div>

                {/* Medical Safety Guarantee Badge */}
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-teal-950/60 border border-teal-500/30 text-teal-300 text-xs font-medium">
                  <svg className="w-4 h-4 shrink-0 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <span>Zero data loss • Database sessions protected</span>
                </div>
              </div>

              {/* Primary Recovery Actions */}
              <div className="mt-8 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={this.handleReload}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl font-bold text-xs bg-linear-to-r from-teal-500 to-teal-600 text-slate-950 hover:from-teal-400 hover:to-teal-500 active:scale-[0.98] transition-all shadow-lg shadow-teal-500/20 flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>Reload Screen</span>
                </button>

                <button
                  type="button"
                  onClick={this.handleGoHome}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl font-bold text-xs bg-white/10 text-white hover:bg-white/15 active:scale-[0.98] transition-all border border-white/10 flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                  <span>Return to Home Dashboard</span>
                </button>

                <button
                  type="button"
                  onClick={this.handleResetCacheAndReload}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl font-medium text-xs text-ink-400 hover:text-white hover:bg-white/5 transition-all"
                  title="Purges temporary UI view state and redirects home"
                >
                  Reset View State
                </button>
              </div>

              {/* Diagnostics & Technical Details */}
              <div className="mt-8 pt-6 border-t border-white/10">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => this.setState((prev) => ({ showDetails: !prev.showDetails }))}
                    className="text-xs font-semibold text-teal-400 hover:text-teal-300 flex items-center gap-1.5 transition-colors"
                  >
                    <svg
                      className={`w-3.5 h-3.5 transition-transform ${this.state.showDetails ? 'rotate-90' : ''}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                    </svg>
                    <span>{this.state.showDetails ? 'Hide Diagnostics' : 'Show Diagnostic Log'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={this.handleCopyDiagnostics}
                    className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-colors flex items-center gap-1.5 ${
                      this.state.copied
                        ? 'bg-teal-500/20 text-teal-300 border-teal-500/40'
                        : 'bg-white/5 text-ink-300 border-white/10 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {this.state.copied ? (
                      <>
                        <svg className="w-3 h-3 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                        </svg>
                        <span>Diagnostic Copied!</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        <span>Copy Diagnostic Report</span>
                      </>
                    )}
                  </button>
                </div>

                {this.state.showDetails && (
                  <div className="mt-3 rounded-2xl bg-black/40 border border-white/10 p-4 font-mono text-xs text-ink-300 space-y-2 animate-in fade-in duration-200 overflow-hidden">
                    <div className="flex items-start justify-between gap-2 text-rose-300 pb-2 border-b border-white/5">
                      <span className="font-bold">{this.state.error?.name || 'Rendering Error'}:</span>
                      <span className="text-[11px] text-ink-400">{new Date().toLocaleTimeString()}</span>
                    </div>
                    <p className="text-amber-200 font-semibold break-all">
                      {this.state.error?.message || 'Unknown error occurred in component tree.'}
                    </p>

                    {isDev && this.state.error?.stack && (
                      <div className="pt-2">
                        <span className="text-[10px] uppercase font-bold text-ink-500 tracking-wider">Stack Trace:</span>
                        <pre className="mt-1 text-[11px] text-ink-400 overflow-x-auto max-h-48 p-2 rounded-lg bg-black/50 leading-tight">
                          {this.state.error.stack}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Quick Access Health Links */}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-xs text-ink-400">
              <span>Quick Navigate:</span>
              <a href="/medicines" className="hover:text-teal-300 transition-colors underline underline-offset-4">
                💊 My Medicines
              </a>
              <span>•</span>
              <a href="/timeline" className="hover:text-teal-300 transition-colors underline underline-offset-4">
                🩺 Medical Timeline
              </a>
              <span>•</span>
              <a href="/assistant" className="hover:text-teal-300 transition-colors underline underline-offset-4">
                ✨ Clinical Assistant
              </a>
              <span>•</span>
              <a href="/settings" className="hover:text-teal-300 transition-colors underline underline-offset-4">
                ⚙️ Settings
              </a>
            </div>
          </div>

          {/* Footer Bar */}
          <div className="max-w-4xl w-full mx-auto text-center py-2 text-[11px] text-ink-500 border-t border-white/5">
            Emergency Notice: If you are experiencing a severe medical emergency, please dial 1122 or visit your nearest emergency room immediately.
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
