import { clsx } from 'clsx';
import { Button } from './Button';
import { Badge } from './Badge';
import { SLOT_META } from './slotMeta';
import { CheckIcon } from './icons';
import { bucketOf } from '../../domain/timeBuckets';
import { mealRelationOf } from '../../domain/mealRelation';
import { formatDoseTime } from '../../lib/time';
import { Package, AlertCircle, Pill, Utensils, Droplets, Info } from 'lucide-react';

export type DoseStatus = 'pending' | 'taken' | 'skipped' | 'missed';

export interface DoseCardProps {
  medicineName: string;
  strength?: string | null;
  /** e.g. "1 tablet" — shown next to the strength when known. */
  doseAmount?: string | null;
  scheduledMinutes: number;
  status: DoseStatus;
  withFood?: boolean | null;
  instructions?: string | null;
  skippedReason?: string | null;
  /** Remaining pills, when the cabinet is tracking this medicine. */
  remaining?: number | null;
  onTake?: () => void;
  onSkip?: () => void;
  onUndo?: () => void;
  /** Disables the actions, e.g. while browsing a past date. */
  readOnly?: boolean;
  className?: string;
}

const statusBadge: Record<DoseStatus, { tone: 'ok' | 'warn' | 'neutral'; label: string } | null> = {
  pending: null,
  taken: { tone: 'ok', label: 'Taken' },
  missed: { tone: 'warn', label: 'Overdue' },
  skipped: { tone: 'neutral', label: 'Skipped' },
};

/**
 * A redesigned, high-contrast, clinical dose card with medicine avatar,
 * inline attributes, contextual meal guidance, and balanced action triggers.
 */
export function DoseCard({
  medicineName,
  strength,
  doseAmount,
  scheduledMinutes,
  status,
  withFood,
  instructions,
  skippedReason,
  remaining,
  onTake,
  onSkip,
  onUndo,
  readOnly = false,
  className,
}: DoseCardProps) {
  const slot = SLOT_META[bucketOf(scheduledMinutes)];
  const relation = mealRelationOf(withFood);
  const badge = statusBadge[status];
  const isActionable = status === 'pending' || status === 'missed';
  const isSettled = status === 'taken' || status === 'skipped';
  const isLowStock = typeof remaining === 'number' && remaining <= 5;

  return (
    <article
      className={clsx(
        'relative overflow-hidden rounded-2xl border bg-surface-raised/95 backdrop-blur-md shadow-card hover:shadow-raise transition-all duration-[var(--duration-base)]',
        status === 'missed'
          ? 'border-amber-500/40 bg-amber-500/[0.03] ring-1 ring-amber-500/20'
          : status === 'taken'
            ? 'border-teal-500/30 bg-teal-500/[0.02]'
            : 'border-line hover:border-line-strong',
        isSettled && 'opacity-90',
        className
      )}
    >
      {/* Left Slot Accent Rail */}
      <span
        className={clsx(
          'absolute inset-y-0 left-0 w-1.5 shadow-sm transition-all',
          status === 'taken' ? 'bg-teal-500' : status === 'missed' ? 'bg-amber-500' : slot.surface
        )}
        aria-hidden="true"
      />

      <div className="p-4 sm:p-5 pl-5 sm:pl-6 space-y-3.5">
        {/* Top Header Row: Medicine Identity + Time & Status */}
        <div className="flex items-start justify-between gap-3 flex-wrap sm:flex-nowrap">
          {/* Left: Icon Avatar + Name + Badges */}
          <div className="flex items-start gap-3 min-w-0">
            <div
              className={clsx(
                'w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border shadow-2xs transition-colors',
                status === 'taken'
                  ? 'bg-teal-500/10 text-teal-600 border-teal-500/20'
                  : status === 'missed'
                    ? 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                    : 'bg-surface-sunken text-accent border-line'
              )}
            >
              <Pill size={20} />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3
                  className={clsx(
                    'text-base sm:text-lg font-bold tracking-tight text-content',
                    status === 'taken' && 'line-through text-content-muted decoration-teal-500/50'
                  )}
                >
                  {medicineName}
                </h3>
                {badge && (
                  <Badge tone={badge.tone} size="sm" withIcon>
                    {badge.label}
                    {status === 'skipped' && skippedReason ? `: ${skippedReason}` : ''}
                  </Badge>
                )}
              </div>

              {/* Medicine Attributes Row: Strength, Form, Meal */}
              <div className="mt-1.5 flex items-center gap-2 flex-wrap text-xs">
                {strength && (
                  <span className="px-2 py-0.5 rounded-md bg-surface-sunken border border-line text-content font-bold text-[11px]">
                    {strength}
                  </span>
                )}
                {doseAmount && (
                  <span className="text-content-muted font-medium text-xs">
                    {doseAmount}
                  </span>
                )}
                {relation === 'with_food' && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-[11px] font-semibold">
                    <Utensils size={11} />
                    With Food
                  </span>
                )}
                {relation === 'empty_stomach' && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-500/10 border border-blue-500/20 text-blue-800 dark:text-blue-300 text-[11px] font-semibold">
                    <Droplets size={11} />
                    Empty Stomach
                  </span>
                )}
                {relation === 'unspecified' && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-surface-sunken border border-line text-content-subtle text-[11px] font-medium">
                    <Info size={11} />
                    Standard timing
                  </span>
                )}
                {typeof remaining === 'number' && (
                  <span
                    className={clsx(
                      'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border',
                      isLowStock
                        ? 'bg-rose-500/10 border-rose-500/20 text-rose-700 dark:text-rose-400'
                        : 'bg-surface-sunken border-line text-content-subtle'
                    )}
                  >
                    {isLowStock ? <AlertCircle size={11} /> : <Package size={11} />}
                    {isLowStock ? `Low stock: ${remaining} left` : `${remaining} left`}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right: Scheduled Time Chip */}
          <div
            className={clsx(
              'shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-line shadow-2xs font-bold text-xs self-start',
              status === 'taken'
                ? 'bg-teal-500/10 text-teal-700 dark:text-teal-400 border-teal-500/20'
                : status === 'missed'
                  ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20'
                  : clsx(slot.surface, slot.text)
            )}
          >
            <span aria-hidden="true" className="shrink-0">{slot.icon(14)}</span>
            <time data-numeric className="whitespace-nowrap">
              {formatDoseTime(scheduledMinutes)}
            </time>
          </div>
        </div>

        {/* Special Instructions (if present) */}
        {instructions && (
          <div className="text-xs text-content-muted bg-surface-sunken/80 border border-line/60 rounded-xl px-3.5 py-2 leading-relaxed">
            <span className="font-semibold text-content block text-[11px] mb-0.5">Instructions:</span>
            {instructions}
          </div>
        )}

        {/* Action Controls */}
        {!readOnly && (
          <div className="pt-2.5 border-t border-line/60 flex items-center justify-between gap-3">
            {isActionable ? (
              <div className="flex items-center gap-2.5 w-full sm:w-auto">
                <Button
                  variant="primary"
                  size="md"
                  onClick={onTake}
                  leftIcon={<CheckIcon size={16} />}
                  className="h-10 px-5 sm:px-6 font-bold tap-spring shadow-sm flex-1 sm:flex-initial"
                >
                  {status === 'missed' ? 'Take Overdue Dose' : 'Take Dose'}
                </Button>
                <Button
                  variant="secondary"
                  size="md"
                  onClick={onSkip}
                  className="h-10 px-4 text-xs font-semibold tap-spring"
                >
                  Skip
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between w-full">
                <span className="text-xs font-semibold text-teal-700 dark:text-teal-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-teal-500" />
                  {status === 'taken' ? 'Dose recorded as taken' : 'Dose recorded as skipped'}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onUndo}
                  className="text-xs text-content-muted hover:text-content font-semibold h-8 px-2.5"
                >
                  Undo
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
