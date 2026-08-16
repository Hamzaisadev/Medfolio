import { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Logo } from '../ui/Logo';
import { useAuth } from '../../lib/auth/AuthContext';
import { LabFlaskIcon, StethoscopeIcon } from '../ui/icons';

export function TopBar() {
  const location = useLocation();
  const { user, profile, isGuest, signOut } = useAuth();
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on route change
  useEffect(() => {
    setIsMoreOpen(false);
    setIsUserMenuOpen(false);
  }, [location.pathname]);

  // Close dropdowns on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) {
        setIsMoreOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isAuthPage =
    location.pathname === '/login' ||
    location.pathname === '/signup' ||
    location.pathname === '/forgot-password';

  // Dedicated minimal header on login / registration pages
  if (isAuthPage) {
    return (
      <header className="sticky top-0 z-40 w-full border-b border-ink-200 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link
            to="/"
            className="flex items-center gap-2 focus-visible:outline-2 focus-visible:outline-teal-600 rounded-[var(--radius-sm)]"
          >
            <Logo size="md" />
          </Link>

          <div>
            {location.pathname === '/login' ? (
              <Link
                to="/signup"
                className="text-xs font-bold text-teal-800 hover:text-teal-950 px-3.5 py-2 rounded-lg border border-teal-200 bg-teal-50 hover:bg-teal-100 transition-colors"
              >
                Create Account
              </Link>
            ) : (
              <Link
                to="/login"
                className="text-xs font-bold text-teal-800 hover:text-teal-950 px-3.5 py-2 rounded-lg border border-teal-200 bg-teal-50 hover:bg-teal-100 transition-colors"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </header>
    );
  }

  // Core 4 primary links
  const primaryLinks = [
    { label: 'Home', path: '/' },
    { label: 'Schedule', path: '/medicines' },
    { label: 'Timeline', path: '/timeline' },
    { label: 'Assistant', path: '/assistant' },
  ];

  // Secondary tools grouped cleanly in "More"
  const secondaryLinks = [
    {
      label: 'Chronic Vitals (Sugar & BP)',
      path: '/vitals',
      icon: (
        <svg className="w-4 h-4 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
        </svg>
      ),
      desc: 'Blood glucose & blood pressure tracker',
    },
    {
      label: 'Smart Doctor Questions',
      path: '/doctor/questions',
      icon: (
        <svg className="w-4 h-4 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      desc: 'Prepared questions for your next visit',
    },
    {
      label: 'Second-Opinion Dossier',
      path: '/doctor/second-opinion',
      icon: (
        <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      desc: 'Anonymized specialist bundle & PDF',
    },
    {
      label: 'Lab Reports & Biomarkers',
      path: '/reports',
      icon: <LabFlaskIcon size={16} className="text-blue-600" />,
      desc: 'Test records and analyte trends',
    },
    {
      label: 'Doctor Directory',
      path: '/doctors',
      icon: <StethoscopeIcon size={16} className="text-teal-600" />,
      desc: 'Physician visits & advice',
    },
    {
      label: 'Finances & Spend',
      path: '/finances',
      icon: (
        <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      desc: 'Medicines and consultation expenses',
    },
    {
      label: 'Symptom Triage',
      path: '/symptoms',
      icon: (
        <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      ),
      desc: 'Red flag checks & specialist guide',
    },
    {
      label: 'Share Medical Record',
      path: '/share',
      icon: (
        <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
        </svg>
      ),
      desc: 'Temporary PIN and QR access',
    },
  ];

  const isMoreActive = secondaryLinks.some((item) => location.pathname.startsWith(item.path));
  const userInitial = (profile?.full_name || user?.email || 'P').charAt(0).toUpperCase() || 'P';

  return (
    <header className="sticky top-0 z-40 w-full border-b border-ink-200 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
        {/* Left: Brand Logo */}
        <Link
          to="/"
          className="flex items-center gap-2 focus-visible:outline-2 focus-visible:outline-teal-600 rounded-[var(--radius-sm)] shrink-0"
        >
          <Logo size="md" />
        </Link>

        {/* Center: Clean 4-Item Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-1.5">
          {primaryLinks.map((link) => {
            const isActive =
              link.path === '/'
                ? location.pathname === '/'
                : location.pathname.startsWith(link.path);
            return (
              <Link
                key={link.path}
                to={link.path}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors focus-visible:outline-2 focus-visible:outline-teal-600 ${
                  isActive
                    ? 'bg-teal-50 text-teal-900 font-bold'
                    : 'text-ink-600 hover:text-ink-900 hover:bg-ink-100'
                }`}
              >
                {link.label}
              </Link>
            );
          })}

          {/* Clean "More" Dropdown */}
          <div className="relative" ref={moreMenuRef}>
            <button
              type="button"
              onClick={() => setIsMoreOpen((prev) => !prev)}
              className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors focus-visible:outline-2 focus-visible:outline-teal-600 ${
                isMoreActive || isMoreOpen
                  ? 'bg-ink-100 text-ink-900 font-bold'
                  : 'text-ink-600 hover:text-ink-900 hover:bg-ink-100'
              }`}
            >
              <span>More</span>
              <svg
                className={`w-3.5 h-3.5 transition-transform ${isMoreOpen ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {isMoreOpen && (
              <div className="absolute left-0 mt-2 w-64 rounded-xl bg-white border border-ink-200/90 shadow-xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-ink-600 border-b border-ink-100">
                  Health Tools & Hubs
                </div>
                {secondaryLinks.map((item) => {
                  const isActive = location.pathname.startsWith(item.path);
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`flex items-center gap-2.5 px-3 py-2 text-xs transition-colors ${
                        isActive
                          ? 'bg-teal-50 text-teal-950 font-bold'
                          : 'text-ink-700 hover:bg-ink-50 hover:text-ink-950'
                      }`}
                    >
                      <div className="p-1 rounded-md bg-ink-100/70 shrink-0">{item.icon}</div>
                      <div className="flex flex-col min-w-0">
                        <span className="truncate">{item.label}</span>
                        <span className="text-[10px] text-ink-500 font-normal truncate">{item.desc}</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </nav>

        {/* Right: Actions & User Menu */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Quick Search */}
          <Link
            to="/search"
            className={`p-2 rounded-lg text-ink-600 hover:text-ink-900 hover:bg-ink-100 transition-colors ${
              location.pathname === '/search' ? 'bg-ink-100 text-ink-900' : ''
            }`}
            title="Search medical records"
            aria-label="Search records"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </Link>

          {/* User Profile / Menu */}
          {isGuest ? (
            <Link
              to="/login"
              className="text-xs font-bold text-teal-800 hover:text-teal-950 px-3 py-1.5 rounded-lg border border-teal-200 bg-teal-50 hover:bg-teal-100 transition-colors"
            >
              Sign In
            </Link>
          ) : (
            <div className="relative" ref={userMenuRef}>
              <button
                type="button"
                onClick={() => setIsUserMenuOpen((prev) => !prev)}
                className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-ink-100 transition-colors text-ink-700 focus-visible:outline-2 focus-visible:outline-teal-600"
              >
                <div className="w-6 h-6 rounded-full bg-teal-800 text-white flex items-center justify-center text-xs font-bold shrink-0">
                  {userInitial}
                </div>
                <span className="text-xs font-semibold hidden lg:inline-block max-w-[90px] truncate">
                  {profile?.full_name?.split(' ')[0] || user?.email?.split('@')[0]}
                </span>
                <svg className="w-3 h-3 text-ink-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {isUserMenuOpen && (
                <div className="absolute right-0 mt-2 w-52 rounded-xl bg-white border border-ink-200/90 shadow-xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-3.5 py-2 border-b border-ink-100">
                    <p className="text-xs font-bold text-ink-900 truncate">
                      {profile?.full_name || 'Patient'}
                    </p>
                    <p className="text-[11px] text-ink-500 truncate">{user?.email}</p>
                  </div>

                  <Link
                    to="/settings"
                    className="flex items-center gap-2 px-3.5 py-2 text-xs text-ink-700 hover:bg-ink-50 hover:text-ink-900 transition-colors"
                  >
                    <svg className="w-4 h-4 text-ink-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span>Settings & Profile</span>
                  </Link>

                  <Link
                    to="/doctor/brief"
                    className="flex items-center gap-2 px-3.5 py-2 text-xs text-ink-700 hover:bg-ink-50 hover:text-ink-900 transition-colors"
                  >
                    <svg className="w-4 h-4 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span>Clinical Dossier PDF</span>
                  </Link>

                  <div className="my-1 border-t border-ink-100" />

                  <button
                    type="button"
                    onClick={() => signOut()}
                    className="w-full text-left flex items-center gap-2 px-3.5 py-2 text-xs text-red-600 hover:bg-red-50 transition-colors font-semibold"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Primary Action Button */}
          <Link
            to="/prescriptions/new"
            className="inline-flex items-center gap-1.5 h-8 sm:h-9 px-3 text-xs font-bold rounded-lg bg-teal-800 text-white hover:bg-teal-900 active:bg-teal-950 transition-colors shadow-xs shrink-0 ml-1"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
            </svg>
            <span className="hidden sm:inline">Scan Record</span>
            <span className="sm:hidden">Scan</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
