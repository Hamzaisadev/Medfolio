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
        className={`flex flex-col bg-surface-sunken text-content font-sans selection:bg-accent-subtle selection:text-accent-onsubtle ${
          // dvh, not vh: on mobile Safari `100vh` includes the collapsing URL bar,
          // so the page jumped as the bar hid and showed.
          fixedViewport ? 'h-[100dvh] overflow-hidden' : 'min-h-[100dvh]'
        }`}
      >
        <TopBar />
        <main
          className={`flex-1 w-full mx-auto flex flex-col min-h-0 ${
            fullWidth ? 'max-w-7xl' : 'max-w-5xl px-4 md:px-8'
          } ${
            noPadding
              ? 'p-0 pb-16 md:pb-0'
              : 'py-5 md:py-8 pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-10'
          } ${fixedViewport ? 'overflow-hidden' : ''}`}
        >
          {children}
        </main>
        <BottomNav />
      </div>
    </ErrorBoundary>
  );
}
