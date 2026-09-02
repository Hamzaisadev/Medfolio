import { Link } from 'react-router-dom';
import { clsx } from 'clsx';
import { ArrowRight, ArrowLeft, Grid, Compass } from 'lucide-react';

export interface DesignMeta {
  id: number;
  slug: string;
  name: string;
  badge: string;
  concept: string;
}

export const TEST_DESIGNS: DesignMeta[] = [
  {
    id: 1,
    slug: '/test/schedule-1',
    name: 'Chrono-Timeline Rail',
    badge: 'Circadian Axis',
    concept: 'Continuous vertical time-axis with glowing circadian markers, current-time indicator line & tactile pill stamps.',
  },
  {
    id: 2,
    slug: '/test/schedule-2',
    name: '24h Radial Clock Dial',
    badge: 'Chrono-Radar',
    concept: '360° circular 24-hour visualizer dial with countdown radar and floating interactive daypart focus cards.',
  },
  {
    id: 3,
    slug: '/test/schedule-3',
    name: 'Kanban Routine Boards',
    badge: 'Routine Columns',
    concept: 'Horizontal multi-column daypart Kanban board with pill meters, quick routine batch actions, and column progress.',
  },
  {
    id: 4,
    slug: '/test/schedule-4',
    name: 'Bento Grid Health OS',
    badge: 'Apple-Style Bento',
    concept: 'Executive bento dashboard with a prominent "Next Due" Hero widget, micro-cubes, adherence rings, and stock chips.',
  },
  {
    id: 5,
    slug: '/test/schedule-5',
    name: 'Tactile Blister Dispenser',
    badge: 'Physical Pillbox',
    concept: 'Skeuomorphic digital blister pack simulator with pop-in 3D pills, frosted glass covers, and tactile empty stamps.',
  },
  {
    id: 6,
    slug: '/test/schedule-6',
    name: 'Linear Clinical Matrix',
    badge: 'High-Density Table',
    concept: 'Bloomberg/Linear-grade compact medical data matrix with keyboard shortcuts (1-9) for rapid clinical power-logging.',
  },
  {
    id: 7,
    slug: '/test/schedule-7',
    name: 'Focus Deck: 1-Dose Center',
    badge: 'Distraction-Free',
    concept: 'Zen focus mode spotlighting only the next due medicine with extra-large typography, instructions & bottom carousel.',
  },
  {
    id: 8,
    slug: '/test/schedule-8',
    name: 'Regimen Matrix Table',
    badge: 'Medicine × Routine',
    concept: 'Full polypharmacy matrix with Medicines on Y-axis and Routines on X-axis for comprehensive single-glance review.',
  },
  {
    id: 9,
    slug: '/test/schedule-9',
    name: 'Concentric Activity Rings',
    badge: 'Fitness Rings',
    concept: 'Apple Fitness-style concentric daypart progress rings that dynamically fill in real time with interactive micro-pods.',
  },
  {
    id: 10,
    slug: '/test/schedule-10',
    name: 'Capsule Pill Stream',
    badge: '3D Capsule Cards',
    concept: 'Modern floating dual-tone capsule cards with fluid slide-to-confirm tactile logging and circadian mood lighting.',
  },
];

export function TestDesignNavbar({ currentId }: { currentId: number }) {
  const current: DesignMeta =
    TEST_DESIGNS.find((d) => d.id === currentId) ?? (TEST_DESIGNS[0] as DesignMeta);
  const prevDesign = TEST_DESIGNS[currentId - 2];
  const nextDesign = TEST_DESIGNS[currentId];

  return (
    <div className="sticky top-0 z-40 bg-surface/95 backdrop-blur-md border-b border-line shadow-xs mb-6">
      {/* Top Banner with Switcher Pills */}
      <div className="max-w-6xl mx-auto px-3 sm:px-6 py-2.5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          {/* Active Design Meta */}
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-xl bg-accent text-white flex items-center justify-center font-black text-sm shadow-xs">
              {current.id}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-bold text-content leading-tight">
                  Design {current.id}: {current.name}
                </h1>
                <span className="px-2 py-0.5 rounded-md bg-accent/10 border border-accent/20 text-accent font-black text-[10px] uppercase tracking-wider">
                  {current.badge}
                </span>
              </div>
              <p className="text-xs text-content-muted line-clamp-1 max-w-xl">
                {current.concept}
              </p>
            </div>
          </div>

          {/* Quick Prev / Next Navigation */}
          <div className="flex items-center gap-1.5 shrink-0 ml-auto">
            {prevDesign && (
              <Link
                to={prevDesign.slug}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-content-muted hover:text-content hover:bg-surface-sunken border border-line"
              >
                <ArrowLeft size={13} />
                <span className="hidden sm:inline">Design {prevDesign.id}</span>
              </Link>
            )}

            <Link
              to="/test/schedules"
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-accent hover:bg-accent/10 border border-accent/20"
              title="View all 10 designs gallery"
            >
              <Grid size={13} />
              <span className="hidden sm:inline">Gallery</span>
            </Link>

            {nextDesign && (
              <Link
                to={nextDesign.slug}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-accent text-white hover:bg-accent-hover shadow-2xs"
              >
                <span className="hidden sm:inline">Design {nextDesign.id}</span>
                <ArrowRight size={13} />
              </Link>
            )}
          </div>
        </div>

        {/* Scrollable Design Switcher Strip */}
        <div className="mt-2.5 pt-2 border-t border-line/60 flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <span className="text-[11px] font-bold text-content-subtle uppercase tracking-wider shrink-0 mr-1 flex items-center gap-1">
            <Compass size={12} /> Designs:
          </span>
          {TEST_DESIGNS.map((d) => {
            const isActive = currentId === d.id;
            return (
              <Link
                key={d.id}
                to={d.slug}
                className={clsx(
                  'px-2.5 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 tap-spring',
                  isActive
                    ? 'bg-accent text-white shadow-2xs'
                    : 'bg-surface-sunken hover:bg-surface-hover text-content-muted hover:text-content border border-line'
                )}
              >
                <span
                  className={clsx(
                    'w-4 h-4 rounded-full flex items-center justify-center text-[10px]',
                    isActive ? 'bg-white/20 text-white' : 'bg-line text-content-subtle font-bold'
                  )}
                >
                  {d.id}
                </span>
                <span>{d.name}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
