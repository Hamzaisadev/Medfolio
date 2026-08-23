import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { clsx } from 'clsx';
import { Logo } from '../ui/Logo';
import { useAuth } from '../../lib/auth/AuthContext';
import { PRIMARY_NAV, SECONDARY_NAV, isNavItemActive } from './navigation';
import {
  SearchIcon,
  PlusIcon,
  ChevronDownIcon,
  SettingsIcon,
  FileTextIcon,
  LogOutIcon,
} from '../ui/icons';

const menuPanel = clsx(
  'z-50 min-w-56 rounded-[var(--radius-lg)] border border-line bg-surface-raised shadow-over p-1.5',
  'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
  'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95'
);

const menuItem = clsx(
  'flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-md)] text-sm text-content-muted',
  'cursor-pointer select-none outline-none transition-colors',
  'data-[highlighted]:bg-surface-hover data-[highlighted]:text-content'
);

export function TopBar() {
  const location = useLocation();
  const { user, profile, isGuest, signOut } = useAuth();

  // Radix closes on select, but a route change driven by anything else (back
  // button, redirect) should close it too.
  const [menuKey, setMenuKey] = useState(0);
  useEffect(() => setMenuKey((k) => k + 1), [location.pathname]);

  const isAuthPage =
    location.pathname === '/login' ||
    location.pathname === '/signup' ||
    location.pathname === '/forgot-password';

  if (isAuthPage) {
    return (
      <header className="sticky top-0 z-40 w-full border-b border-line bg-surface/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center rounded-[var(--radius-sm)]" aria-label="Medfolio home">
            <Logo size="md" />
          </Link>
          <Link
            to={location.pathname === '/login' ? '/signup' : '/login'}
            className="inline-flex items-center h-10 px-4 text-xs font-bold rounded-[var(--radius-md)] border border-line bg-surface-raised text-content hover:bg-surface-hover transition-colors"
          >
            {location.pathname === '/login' ? 'Create account' : 'Sign in'}
          </Link>
        </div>
      </header>
    );
  }

  const isMoreActive = SECONDARY_NAV.some(
    (item) => item.path !== '/settings' && isNavItemActive(item.path, location.pathname)
  );
  const displayName = profile?.full_name || user?.email || 'Patient';
  const userInitial = displayName.charAt(0).toUpperCase();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-line bg-surface/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-2 px-4 sm:px-6">
        <Link
          to="/"
          className="flex items-center shrink-0 rounded-[var(--radius-sm)]"
          aria-label="Medfolio home"
        >
          <Logo size="md" />
        </Link>

        <nav className="hidden md:flex items-center gap-1" aria-label="Main">
          {PRIMARY_NAV.map((link) => {
            const active = isNavItemActive(link.path, location.pathname);
            return (
              <Link
                key={link.path}
                to={link.path}
                aria-current={active ? 'page' : undefined}
                className={clsx(
                  'px-3.5 py-2 text-xs font-semibold rounded-[var(--radius-md)] transition-colors',
                  active
                    ? 'bg-accent-subtle text-accent-onsubtle'
                    : 'text-content-muted hover:text-content hover:bg-surface-hover'
                )}
              >
                {link.label}
              </Link>
            );
          })}

          {/* Radix rather than a hand-rolled dropdown: the previous version had no
              arrow-key navigation, no Escape handling and no aria-expanded. */}
          <DropdownMenu.Root key={`more-${menuKey}`}>
            <DropdownMenu.Trigger
              className={clsx(
                'inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold rounded-[var(--radius-md)] transition-colors',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                isMoreActive
                  ? 'bg-accent-subtle text-accent-onsubtle'
                  : 'text-content-muted hover:text-content hover:bg-surface-hover',
                'data-[state=open]:bg-surface-hover data-[state=open]:text-content'
              )}
            >
              More
              <ChevronDownIcon
                size={14}
                className="transition-transform data-[state=open]:rotate-180"
              />
            </DropdownMenu.Trigger>

            <DropdownMenu.Portal>
              <DropdownMenu.Content align="start" sideOffset={8} className={clsx(menuPanel, 'w-72')}>
                <DropdownMenu.Label className="px-3 py-2 text-2xs font-bold uppercase tracking-wide text-content-subtle">
                  Health tools
                </DropdownMenu.Label>
                {SECONDARY_NAV.filter((item) => item.path !== '/settings').map((item) => {
                  const active = isNavItemActive(item.path, location.pathname);
                  return (
                    <DropdownMenu.Item key={item.path} asChild>
                      <Link
                        to={item.path}
                        className={clsx(menuItem, active && 'bg-accent-subtle text-accent-onsubtle')}
                      >
                        <span className="shrink-0 text-content-subtle">{item.icon(17)}</span>
                        <span className="flex flex-col min-w-0">
                          <span className="font-semibold truncate">{item.label}</span>
                          {item.description && (
                            <span className="text-2xs text-content-subtle truncate">
                              {item.description}
                            </span>
                          )}
                        </span>
                      </Link>
                    </DropdownMenu.Item>
                  );
                })}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </nav>

        <div className="flex items-center gap-1 shrink-0">
          <Link
            to="/search"
            aria-label="Search records"
            className={clsx(
              'inline-flex items-center justify-center w-11 h-11 rounded-[var(--radius-md)] transition-colors',
              location.pathname === '/search'
                ? 'bg-surface-hover text-content'
                : 'text-content-muted hover:bg-surface-hover hover:text-content'
            )}
          >
            <SearchIcon size={18} />
          </Link>

          {isGuest ? (
            <Link
              to="/login"
              className="inline-flex items-center h-10 px-4 text-xs font-bold rounded-[var(--radius-md)] border border-line bg-surface-raised text-content hover:bg-surface-hover transition-colors"
            >
              Sign in
            </Link>
          ) : (
            <DropdownMenu.Root key={`user-${menuKey}`}>
              <DropdownMenu.Trigger
                className={clsx(
                  'inline-flex items-center gap-1.5 h-11 px-2 rounded-[var(--radius-md)] transition-colors',
                  'text-content-muted hover:bg-surface-hover',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                  'data-[state=open]:bg-surface-hover'
                )}
                aria-label="Account menu"
              >
                <span className="w-7 h-7 rounded-full bg-accent text-content-onaccent flex items-center justify-center text-xs font-bold shrink-0">
                  {userInitial}
                </span>
                <span className="text-xs font-semibold hidden lg:inline-block max-w-24 truncate text-content">
                  {profile?.full_name?.split(' ')[0] || user?.email?.split('@')[0]}
                </span>
                <ChevronDownIcon size={13} className="text-content-subtle" />
              </DropdownMenu.Trigger>

              <DropdownMenu.Portal>
                <DropdownMenu.Content align="end" sideOffset={8} className={menuPanel}>
                  <div className="px-3 py-2.5 border-b border-line mb-1">
                    <p className="text-sm font-bold text-content truncate">
                      {profile?.full_name || 'Patient'}
                    </p>
                    {user?.email && (
                      <p className="text-xs text-content-subtle truncate">{user.email}</p>
                    )}
                  </div>

                  <DropdownMenu.Item asChild>
                    <Link to="/settings" className={menuItem}>
                      <SettingsIcon size={17} className="shrink-0 text-content-subtle" />
                      Settings & profile
                    </Link>
                  </DropdownMenu.Item>

                  <DropdownMenu.Item asChild>
                    <Link to="/doctor/brief" className={menuItem}>
                      <FileTextIcon size={17} className="shrink-0 text-content-subtle" />
                      Doctor summary
                    </Link>
                  </DropdownMenu.Item>

                  <DropdownMenu.Separator className="my-1 h-px bg-line" />

                  <DropdownMenu.Item asChild>
                    <button
                      type="button"
                      onClick={() => signOut()}
                      className={clsx(menuItem, 'w-full text-left text-risk-text font-semibold')}
                    >
                      <LogOutIcon size={17} className="shrink-0" />
                      Sign out
                    </button>
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          )}

          <Link
            to="/prescriptions/new"
            className="inline-flex items-center gap-1.5 h-10 sm:h-11 px-3 sm:px-4 text-xs font-bold rounded-[var(--radius-md)] bg-accent text-content-onaccent hover:bg-accent-hover active:bg-accent-active transition-colors shadow-card shrink-0 ml-1"
          >
            <PlusIcon size={16} />
            <span className="hidden sm:inline">Scan record</span>
            <span className="sm:hidden">Scan</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
