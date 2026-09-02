import { useEffect } from 'react';
import { clsx } from 'clsx';
import { AppShell } from '../../components/layout/AppShell';
import { TestDesignNavbar } from './TestDesignNavbar';
import { useTestScheduleData } from './useTestScheduleData';
import { formatDoseTime } from '../../lib/time';
import {
  Check,
  Clock,
  Command,
  Table,
  Package,
  Utensils,
  Droplets,
} from 'lucide-react';

export function ScheduleTest6Page() {
  const {
    doses,
    takenCount,
    totalCount,
    adherencePercent,
    handleTake,
    handleUndo,
  } = useTestScheduleData();

  // Keyboard shortcut listener: 1 through 9 toggles dose
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= doses.length) {
        const target = doses[num - 1];
        if (target) {
          if (target.status === 'taken') {
            handleUndo(target.id);
          } else {
            handleTake(target.id);
          }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [doses, handleTake, handleUndo]);

  return (
    <AppShell>
      <TestDesignNavbar currentId={6} />

      <div className="max-w-6xl mx-auto space-y-5">
        {/* Table Controls & Keyboard Shortcut Hint Bar */}
        <div className="p-4 rounded-2xl bg-surface-raised border border-line shadow-2xs flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-xl bg-surface-sunken border border-line flex items-center justify-center text-accent">
              <Table size={16} />
            </span>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-content leading-tight">
                Clinical Data Matrix View
              </h2>
              <p className="text-xs text-content-muted">
                High-density clinical table with inline status toggles & keyboard hotkeys
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-xl bg-surface-sunken border border-line text-xs text-content-muted">
              <Command size={12} />
              <span>Press 1-{doses.length} to quickly log</span>
            </div>

            <span className="text-xs font-black px-3 py-1 rounded-xl bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-500/20">
              {adherencePercent}% Adherence ({takenCount}/{totalCount})
            </span>
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-hidden rounded-2xl border border-line bg-surface-raised shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-surface-sunken/80 border-b border-line text-content-subtle font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4 w-12 text-center">Key</th>
                  <th className="py-3 px-4 w-28">Scheduled</th>
                  <th className="py-3 px-4">Medication & Form</th>
                  <th className="py-3 px-4">Dosage</th>
                  <th className="py-3 px-4">Meal Rule</th>
                  <th className="py-3 px-4">Stock</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {doses.map((dose, idx) => {
                  const isTaken = dose.status === 'taken';
                  const isMissed = dose.status === 'missed';

                  return (
                    <tr
                      key={dose.id}
                      className={clsx(
                        'hover:bg-surface-sunken/50 transition-colors',
                        isTaken && 'bg-surface-sunken/20 opacity-75'
                      )}
                    >
                      {/* Key badge */}
                      <td className="py-3.5 px-4 text-center">
                        <span className="w-5 h-5 rounded-md bg-surface-sunken border border-line text-[10px] font-black inline-flex items-center justify-center text-content-subtle">
                          {idx + 1}
                        </span>
                      </td>

                      {/* Scheduled Time */}
                      <td className="py-3.5 px-4 font-mono font-bold text-content whitespace-nowrap">
                        <span
                          className={clsx(
                            'inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px]',
                            isTaken
                              ? 'bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-500/20'
                              : isMissed
                                ? 'bg-amber-500/10 text-amber-900 dark:text-amber-200 border-amber-500/20'
                                : 'bg-surface-sunken text-content border-line'
                          )}
                        >
                          <Clock size={11} /> {formatDoseTime(dose.scheduledMinutes)}
                        </span>
                      </td>

                      {/* Medicine Name */}
                      <td className="py-3.5 px-4 font-bold text-content">
                        <div className="flex flex-col">
                          <span className={clsx(isTaken && 'line-through text-content-muted')}>
                            {dose.medicineName}
                          </span>
                          {dose.instructions && (
                            <span className="text-[10px] text-content-subtle font-normal italic truncate max-w-xs">
                              {dose.instructions}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Strength / Dose */}
                      <td className="py-3.5 px-4 whitespace-nowrap font-semibold text-content-muted">
                        <span className="px-2 py-0.5 rounded-md bg-surface-sunken border border-line text-content font-bold text-[11px] mr-1">
                          {dose.strength}
                        </span>
                        {dose.doseAmount}
                      </td>

                      {/* Meal Rule */}
                      <td className="py-3.5 px-4 whitespace-nowrap font-medium">
                        {dose.withFood === true ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 dark:text-amber-300">
                            <Utensils size={11} /> With food
                          </span>
                        ) : dose.withFood === false ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-800 dark:text-blue-300">
                            <Droplets size={11} /> Empty stomach
                          </span>
                        ) : (
                          <span className="text-content-subtle text-[11px]">As directed</span>
                        )}
                      </td>

                      {/* Stock count */}
                      <td className="py-3.5 px-4 whitespace-nowrap font-semibold">
                        <span
                          className={clsx(
                            'inline-flex items-center gap-1 text-[11px]',
                            dose.remaining === 0
                              ? 'text-rose-600 font-bold'
                              : dose.remaining <= 5
                                ? 'text-amber-700 dark:text-amber-300 font-bold'
                                : 'text-content-subtle'
                          )}
                        >
                          <Package size={11} /> {dose.remaining} left
                        </span>
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        {!isTaken ? (
                          <button
                            type="button"
                            onClick={() => handleTake(dose.id)}
                            className={clsx(
                              'px-3 py-1 rounded-xl text-xs font-bold text-white shadow-2xs tap-spring cursor-pointer inline-flex items-center gap-1',
                              isMissed
                                ? 'bg-amber-600 hover:bg-amber-700'
                                : 'bg-teal-600 hover:bg-teal-700'
                            )}
                          >
                            <Check size={12} className="stroke-[3]" />
                            {isMissed ? 'Take Overdue' : 'Log Taken'}
                          </button>
                        ) : (
                          <div className="inline-flex items-center gap-2">
                            <span className="text-[11px] font-bold text-teal-700 dark:text-teal-400">
                              ✓ Logged
                            </span>
                            <button
                              type="button"
                              onClick={() => handleUndo(dose.id)}
                              className="text-[11px] text-content-subtle hover:text-content"
                            >
                              Undo
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
