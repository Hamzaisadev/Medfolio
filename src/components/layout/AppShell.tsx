import React from 'react';
import { TopBar } from './TopBar';
import { BottomNav } from './BottomNav';
import { ErrorBoundary } from './ErrorBoundary';

export interface AppShellProps {
  children: React.ReactNode;
  fullWidth?: boolean;
  noPadding?: boolean;
  fixedViewport?: boolean;
}

export function AppShell({ children, fullWidth, noPadding, fixedViewport }: AppShellProps) {
  return (
    <ErrorBoundary>
      <div
        className={`flex flex-col bg-ink-50 text-ink-900 font-sans selection:bg-brand-100 selection:text-brand-900 ${
          fixedViewport ? 'h-[100dvh] overflow-hidden' : 'min-h-screen'
        }`}
      >
        <TopBar />
        <main
          className={`flex-1 w-full mx-auto flex flex-col min-h-0 ${
            fullWidth ? 'max-w-7xl px-2 sm:px-4' : 'max-w-5xl px-4 md:px-8'
          } ${
            noPadding
              ? 'p-1.5 pb-16 md:pb-2'
              : 'py-4 md:py-6 pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-8'
          } ${fixedViewport ? 'overflow-hidden' : ''}`}
        >
          {children}
        </main>
        <BottomNav />
      </div>
    </ErrorBoundary>
  );
}
