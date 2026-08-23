import { Link, useNavigate } from 'react-router-dom';
import { Logo } from '../../components/ui/Logo';
import { Button } from '../../components/ui/Button';
import { MedicineIcon, StethoscopeIcon } from '../../components/ui/icons';

export function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-linear-to-b from-ink-50 to-white text-ink-900 flex flex-col justify-between p-4 sm:p-6 lg:p-8 font-sans selection:bg-brand-100 selection:text-brand-900">
      {/* Minimal Top Brand Bar (No dashboard navbar / menu clutter) */}
      <header className="max-w-4xl w-full mx-auto flex items-center justify-between py-2 border-b border-ink-200/80">
        <Link to="/" className="flex items-center gap-2 focus-visible:outline-2 focus-visible:outline-teal-600 rounded-lg">
          <Logo size="md" />
        </Link>
        <Link
          to="/"
          className="text-xs font-bold text-teal-800 hover:text-teal-950 px-3 py-1.5 rounded-lg border border-teal-200 bg-teal-50 hover:bg-teal-100 transition-colors"
        >
          Go to Dashboard
        </Link>
      </header>

      {/* Main 404 Centerpiece */}
      <main className="max-w-lg w-full mx-auto my-auto py-8 text-center">
        <div className="bg-white border border-ink-200/80 rounded-3xl p-6 sm:p-10 shadow-xl relative overflow-hidden">
          {/* Animated Medical Compass / 404 Graphic */}
          <div className="relative inline-block mb-5">
            <div className="w-20 h-20 rounded-2xl bg-linear-to-br from-teal-100 to-teal-50 border border-teal-200 flex items-center justify-center text-teal-800 shadow-md">
              <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.75"
                  d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                />
              </svg>
            </div>
            <span className="absolute -bottom-1 -right-1 px-2 py-0.5 rounded-full bg-teal-800 text-white text-[10px] font-black shadow-xs">
              404
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-ink-900 tracking-tight">
            Page Not Found
          </h1>
          <p className="mt-2 text-xs sm:text-sm text-ink-600 leading-relaxed">
            The page or record link you requested could not be found. Your active health records and medications remain secure.
          </p>

          {/* Action Buttons */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Button variant="primary" size="md" onClick={() => navigate('/')}>
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              Back to Dashboard
            </Button>

            <Button variant="secondary" size="md" onClick={() => navigate(-1)}>
              Go Back
            </Button>
          </div>

          {/* Quick Shortcuts */}
          <div className="mt-8 pt-6 border-t border-ink-100 text-left">
            <p className="text-[10px] uppercase font-bold text-ink-400 tracking-wider mb-2.5 text-center">
              Quick Shortcuts
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Link
                to="/medicines"
                className="p-2.5 rounded-xl border border-ink-200/80 bg-ink-50/50 hover:border-teal-300 hover:bg-teal-50/50 transition-colors group"
              >
                <p className="text-xs font-bold text-ink-900 group-hover:text-teal-950 flex items-center gap-1.5">
                  <MedicineIcon size={14} className="text-purple-700" /> Pill Schedule
                </p>
                <p className="text-[10px] text-ink-500 mt-0.5">Dose timetable</p>
              </Link>

              <Link
                to="/timeline"
                className="p-2.5 rounded-xl border border-ink-200/80 bg-ink-50/50 hover:border-teal-300 hover:bg-teal-50/50 transition-colors group"
              >
                <p className="text-xs font-bold text-ink-900 group-hover:text-teal-950 flex items-center gap-1.5">
                  <StethoscopeIcon size={14} className="text-teal-700" /> Timeline
                </p>
                <p className="text-[10px] text-ink-500 mt-0.5">Visits & prescriptions</p>
              </Link>
            </div>
          </div>
        </div>
      </main>

      {/* Minimal Footer */}
      <footer className="max-w-4xl w-full mx-auto text-center py-2 text-[11px] text-ink-400 border-t border-ink-200/60">
        Medfolio • Personal Health Record & Timetable
      </footer>
    </div>
  );
}
