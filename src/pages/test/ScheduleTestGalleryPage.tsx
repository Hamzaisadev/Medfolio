import { Link } from 'react-router-dom';
import { AppShell } from '../../components/layout/AppShell';
import { TEST_DESIGNS } from './TestDesignNavbar';
import { ArrowRight, Layers } from 'lucide-react';

export function ScheduleTestGalleryPage() {
  return (
    <AppShell>
      <div className="max-w-6xl mx-auto space-y-8 py-4">
        {/* Gallery Intro Banner */}
        <div className="p-6 sm:p-8 rounded-3xl bg-linear-to-r from-teal-900 via-teal-800 to-emerald-950 text-white shadow-md relative overflow-hidden">
          <div className="relative z-10 max-w-3xl space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md text-xs font-black uppercase tracking-wider text-emerald-200 border border-white/10">
              <Layers size={13} className="text-amber-300" />
              10 Experimental Medication Scheduling Interfaces
            </div>
            <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white">
              Medication Schedule Design Lab
            </h1>
            <p className="text-xs sm:text-sm text-emerald-100/90 leading-relaxed">
              Explore and test 10 completely distinct design paradigms for daily medication tracking.
              Each design offers a unique interaction model—from continuous chronological rails to
              24-hour radar dials, routine Kanban boards, Apple-style Bento OS, and physical blister packs.
            </p>
          </div>
        </div>

        {/* 10 Designs Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {TEST_DESIGNS.map((design) => (
            <Link
              key={design.id}
              to={design.slug}
              className="group p-5 sm:p-6 rounded-3xl border border-line bg-surface-raised hover:border-accent hover:shadow-card-hover transition-all duration-200 flex flex-col justify-between space-y-4"
            >
              <div>
                <div className="flex items-center justify-between gap-3">
                  <span className="w-9 h-9 rounded-2xl bg-accent text-white flex items-center justify-center font-black text-sm shadow-xs group-hover:scale-105 transition-transform">
                    {design.id}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-lg bg-accent/10 border border-accent/20 text-accent font-black text-[11px] uppercase tracking-wider">
                    {design.badge}
                  </span>
                </div>

                <h3 className="text-lg font-black text-content tracking-tight mt-3 group-hover:text-accent transition-colors">
                  Design {design.id}: {design.name}
                </h3>
                <p className="text-xs text-content-muted leading-relaxed mt-1.5">
                  {design.concept}
                </p>
              </div>

              <div className="pt-3 border-t border-line/60 flex items-center justify-between text-xs font-bold text-accent group-hover:translate-x-1 transition-transform">
                <span>Launch Design {design.id}</span>
                <ArrowRight size={14} />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
