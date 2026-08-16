import { Link, useLocation } from 'react-router-dom';
import { MedicineIcon, StethoscopeIcon } from '../ui/icons';

export function BottomNav() {
  const location = useLocation();

  const navItems = [
    {
      label: 'Home',
      path: '/',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
    },
    {
      label: 'Schedule',
      path: '/medicines',
      icon: <MedicineIcon size={20} />,
    },
    {
      label: 'Timeline',
      path: '/timeline',
      icon: <StethoscopeIcon size={20} />,
    },
    {
      label: 'Assistant',
      path: '/assistant',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      ),
    },
    {
      label: 'More',
      path: '/settings',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      ),
    },
  ];

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 h-16 border-t border-ink-200 bg-white/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)]"
      aria-label="Mobile navigation"
    >
      <div className="grid h-full grid-cols-5 items-center">
        {navItems.map((item) => {
          const isActive =
            location.pathname === item.path ||
            (item.path !== '/' && item.path !== '/settings' && location.pathname.startsWith(item.path)) ||
            (item.path === '/settings' && (location.pathname === '/settings' || location.pathname === '/symptoms' || location.pathname === '/search'));

          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center justify-center h-full min-h-[44px] py-1 transition-colors select-none ${
                isActive ? 'text-brand-600 font-semibold' : 'text-ink-500 hover:text-ink-800'
              }`}
            >
              <div className="flex items-center justify-center shrink-0">{item.icon}</div>
              <span className="text-[10px] mt-0.5 leading-tight">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
