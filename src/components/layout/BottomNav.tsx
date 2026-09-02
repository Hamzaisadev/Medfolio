import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { clsx } from 'clsx';
import { motion } from 'motion/react';
import { Sheet } from '../ui/Sheet';
import { MenuIcon } from '../ui/icons';
import { BOTTOM_NAV_ITEMS, MOBILE_MORE_NAV, isNavItemActive } from './navigation';

export function BottomNav() {
  const location = useLocation();
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  useEffect(() => setIsMoreOpen(false), [location.pathname]);

  const isMoreActive = MOBILE_MORE_NAV.some((item) => isNavItemActive(item.path, location.pathname));

  return (
    <>
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-line bg-surface/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)]"
        aria-label="Main"
      >
        <div className="grid h-16 grid-cols-5 items-center relative">
          {BOTTOM_NAV_ITEMS.map((item) => {
            const active = isNavItemActive(item.path, location.pathname);
            return (
              <Link
                key={item.path}
                to={item.path}
                aria-current={active ? 'page' : undefined}
                className={clsx(
                  'relative flex flex-col items-center justify-center gap-1 h-full min-h-11 px-1 select-none transition-colors duration-[var(--duration-fast)]',
                  active ? 'text-accent' : 'text-content-subtle hover:text-content'
                )}
              >
                {active && (
                  <motion.div
                    layoutId="bottom-nav-active-pill"
                    className="absolute top-1 w-8 h-1 rounded-full bg-accent"
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  />
                )}
                <span className="shrink-0">{item.icon(21)}</span>
                <span className={clsx('text-2xs leading-none', active && 'font-bold')}>
                  {item.label}
                </span>
              </Link>
            );
          })}

          <button
            type="button"
            onClick={() => setIsMoreOpen(true)}
            aria-expanded={isMoreOpen}
            aria-haspopup="dialog"
            className={clsx(
              'relative flex flex-col items-center justify-center gap-1 h-full min-h-11 px-1 select-none transition-colors duration-[var(--duration-fast)] cursor-pointer',
              isMoreActive || isMoreOpen ? 'text-accent' : 'text-content-subtle hover:text-content'
            )}
          >
            {(isMoreActive || isMoreOpen) && (
              <motion.div
                layoutId="bottom-nav-active-pill"
                className="absolute top-1 w-8 h-1 rounded-full bg-accent"
                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
              />
            )}
            <span className="shrink-0">
              <MenuIcon size={21} />
            </span>
            <span className={clsx('text-2xs leading-none', (isMoreActive || isMoreOpen) && 'font-bold')}>More</span>
          </button>
        </div>
      </nav>

      <Sheet
        open={isMoreOpen}
        onOpenChange={setIsMoreOpen}
        title="All tools"
        description="Everything in your health record."
      >
        <ul className="flex flex-col gap-1.5">
          {MOBILE_MORE_NAV.map((item) => {
            const active = isNavItemActive(item.path, location.pathname);
            return (
              <li key={item.path}>
                <Link
                  to={item.path}
                  onClick={() => setIsMoreOpen(false)}
                  aria-current={active ? 'page' : undefined}
                  className={clsx(
                    'flex items-center gap-3.5 p-3.5 rounded-[var(--radius-lg)] border transition-all duration-[var(--duration-fast)]',
                    active
                      ? 'border-accent bg-accent-subtle text-accent-onsubtle shadow-xs font-semibold'
                      : 'border-line bg-surface-raised text-content hover:bg-surface-hover hover:border-line-strong'
                  )}
                >
                  <span
                    className={clsx(
                      'shrink-0 flex items-center justify-center w-10 h-10 rounded-[var(--radius-md)] transition-colors',
                      active ? 'bg-surface-raised text-accent' : 'bg-surface-sunken text-content-muted'
                    )}
                  >
                    {item.icon(19)}
                  </span>
                  <span className="flex flex-col min-w-0">
                    <span className="text-sm font-semibold">{item.label}</span>
                    {item.description && (
                      <span className="text-xs text-content-subtle">{item.description}</span>
                    )}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </Sheet>
    </>
  );
}
