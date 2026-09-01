import { clsx } from 'clsx';
import { Button } from './Button';
import { Badge } from './Badge';
import { SLOT_META } from './slotMeta';
import { CheckIcon } from './icons';
import { bucketOf } from '../../domain/timeBuckets';
import { mealRelationOf } from '../../domain/mealRelation';
import { formatDoseTime } from '../../lib/time';
import {
  Package,
  AlertCircle,
  Pill,
  Utensils,
  Droplets,
  HelpCircle,
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
} from 'lucide-react';

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
  /** Compact row layout for grouped routine cards */
  variant?: 'card' | 'row';
  className?: string;
}

const statusBadge: Record<DoseStatus, { tone: 'ok' | 'warn' | 'neutral'; label: string } | null> = {
  pending: null,
  taken: { tone: 'ok', label: 'Taken' },
  missed: { tone: 'warn', label: 'Overdue' },
  skipped: { tone: 'neutral', label: 'Skipped' },
};

/**
 * Modern Clinical Medication Card & Row Component
 * Used both standalone (hero cards) and grouped inside Chronotherapy Routine Decks.
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
  variant = 'card',
  className,
}: DoseCardProps) {
  const slot = SLOT_META[bucketOf(scheduledMinutes)];
  const relation = mealRelationOf(withFood);
  const badge = statusBadge[status];
  const isActionable = status === 'pending' || status === 'missed';
  const isSettled = status === 'taken' || status === 'skipped';
  const isLowStock = typeof remaining === 'number' && remaining <= 5;

  // Render unified row style (for grouped decks)
  if (variant === 'row') {
    return (
      <div
        className={clsx(
          'group relative p-3.5 sm:p-4 hover:bg-surface-hover/50 transition-colors duration-150',
          status === 'taken' && 'bg-teal-500/[0.015]',
          status === 'missed' && 'bg-amber-500/[0.02]',
          className
        )}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          {/* Left: Checkmark Action Trigger + Medicine Details */}
          <div className="flex items-start gap-3 min-w-0 flex-1">
            {/* Quick-action status circle */}
            <button
              type="button"
              disabled={readOnly || isSettled}
              onClick={isActionable ? onTake : undefined}
              aria-label={
                status === 'taken'
                  ? 'Dose already taken'
                  : status === 'skipped'
                    ? 'Dose skipped'
                    : `Mark ${medicineName} as taken`
              }
              className={clsx(
                'w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all mt-0.5 sm:mt-0',
                status === 'taken'
                  ? 'bg-teal-500 text-white shadow-2xs cursor-default'
                  : status === 'missed'
                    ? 'border-2 border-amber-500 bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 cursor-pointer'
                    : status === 'skipped'
                      ? 'bg-surface-sunken text-content-muted border border-line cursor-default'
                      : 'border-2 border-line hover:border-accent hover:bg-accent/10 text-transparent hover:text-accent cursor-pointer group-hover:scale-105'
              )}
            >
              {status === 'taken' ? (
                <CheckCircle2 size={18} className="text-white" />
              ) : status === 'skipped' ? (
                <XCircle size={16} />
              ) : status === 'missed' ? (
                <Clock size={15} />
              ) : (
                <CheckIcon size={14} />
              )}
            </button>

            {/* Medicine Identity & Metadata */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={clsx(
                    'text-sm sm:text-base font-bold text-content leading-snug',
                    status === 'taken' && 'line-through text-content-muted decoration-teal-500/50'
                  )}
                >
                  {medicineName}
                </span>

                {badge && (
                  <Badge tone={badge.tone} size="sm" withIcon>
                    {badge.label}
                    {status === 'skipped' && skippedReason ? `: ${skippedReason}` : ''}
                  </Badge>
                )}
              </div>

              {/* Inline Clinical Chips */}
              <div className="mt-1 flex items-center gap-1.5 sm:gap-2 flex-wrap text-xs">
                {strength && (
                  <span className="px-1.5 py-0.5 rounded-md bg-surface-sunken border border-line text-content font-bold text-[11px]">
                    {strength}
                  </span>
                )}
                {doseAmount && (
                  <span className="text-content-muted font-medium text-xs">
                    {doseAmount}
                  </span>
                )}

                {/* Meal Guidance Chip */}
                {relation === 'with_food' && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-[11px] font-semibold">
                    <Utensils size={10} />
                    With Food
                  </span>
                )}
                {relation === 'empty_stomach' && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-blue-500/10 border border-blue-500/20 text-blue-800 dark:text-blue-300 text-[11px] font-semibold">
                    <Droplets size={10} />
                    Empty Stomach
                  </span>
                )}
                {relation === 'unspecified' && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-surface-sunken border border-line text-content-subtle text-[11px] font-medium">
                    <HelpCircle size={10} />
                    As Directed
                  </span>
                )}

                {/* Cabinet Stock Pill */}
                {typeof remaining === 'number' && (
                  <span
                    className={clsx(
                      'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-semibold border',
                      isLowStock
                        ? 'bg-rose-500/10 border-rose-500/20 text-rose-700 dark:text-rose-400'
                        : 'bg-surface-sunken border-line text-content-subtle'
                    )}
                  >
                    {isLowStock ? <AlertCircle size={10} /> : <Package size={10} />}
                    {isLowStock ? `Low: ${remaining}` : `${remaining} left`}
                  </span>
                )}
              </div>

              {/* Special Instructions */}
              {instructions && (
                <div className="mt-1.5 text-xs text-content-muted bg-surface-sunken/60 border border-line/60 rounded-lg px-2.5 py-1 flex items-start gap-1.5 max-w-xl">
                  <FileText size={12} className="text-accent shrink-0 mt-0.5" />
                  <span className="text-[11px] leading-tight">{instructions}</span>
                </div>
              )}
            </div>
          </div>

          {/* Right: Actions */}
          {!readOnly && (
            <div className="flex items-center justify-end gap-2 shrink-0 pl-11 sm:pl-0">
              {isActionable ? (
                <>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={onTake}
                    leftIcon={<CheckIcon size={14} />}
                    className={clsx(
                      'h-8 px-3.5 font-bold tap-spring shadow-2xs text-xs whitespace-nowrap',
                      status === 'missed'
                        ? 'bg-amber-600 hover:bg-amber-700 border-amber-600'
                        : 'bg-teal-600 hover:bg-teal-700 border-teal-600'
                    )}
                  >
                    {status === 'missed' ? 'Take Overdue' : 'Take'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onSkip}
                    className="h-8 px-2.5 text-xs text-content-muted hover:text-content font-semibold hover:bg-surface-hover tap-spring"
                  >
                    Skip
                  </Button>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-teal-700 dark:text-teal-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />
                    {status === 'taken' ? 'Logged' : 'Skipped'}
                  </span>
                  <button
                    type="button"
                    onClick={onUndo}
                    className="text-xs text-content-subtle hover:text-content font-medium underline px-1 transition-colors cursor-pointer"
                  >
                    Undo
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Standalone Card variant (for Dashboard next-dose hero or single card views)
  return (
    <article
      className={clsx(
        'group relative overflow-hidden rounded-2xl border bg-surface-raised/95 backdrop-blur-md shadow-card hover:shadow-raise transition-all duration-[var(--duration-base)]',
        status === 'missed'
          ? 'border-amber-500/40 bg-amber-500/[0.03] ring-1 ring-amber-500/20'
          : status === 'taken'
            ? 'border-teal-500/30 bg-teal-500/[0.02]'
            : 'border-line hover:border-line-strong',
        isSettled && 'opacity-90',
        className
      )}
    >
      {/* Left Slot Accent Color Rail */}
      <span
        className={clsx(
          'absolute inset-y-0 left-0 w-1.5 shadow-sm transition-all',
          status === 'taken' ? 'bg-teal-500' : status === 'missed' ? 'bg-amber-500' : slot.surface
        )}
        aria-hidden="true"
      />

      <div className="p-4 sm:p-5 pl-5 sm:pl-6 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Left: Avatar + Medicine Details */}
          <div className="flex items-start gap-3.5 min-w-0 flex-1">
            <div
              className={clsx(
                'w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 border shadow-2xs transition-transform duration-200 group-hover:scale-105',
                status === 'taken'
                  ? 'bg-teal-500/10 text-teal-600 border-teal-500/20'
                  : status === 'missed'
                    ? 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                    : 'bg-surface-sunken text-accent border-line'
              )}
            >
              {status === 'taken' ? (
                <CheckCircle2 size={22} className="text-teal-600" />
              ) : status === 'skipped' ? (
                <XCircle size={22} className="text-content-muted" />
              ) : (
                <Pill size={22} />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3
                  className={clsx(
                    'text-base sm:text-lg font-bold tracking-tight text-content leading-snug',
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

              <div className="mt-1.5 flex items-center gap-1.5 sm:gap-2 flex-wrap text-xs">
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
                    <HelpCircle size={11} />
                    As Directed
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
                    {isLowStock ? `Low: ${remaining} left` : `${remaining} left`}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right: Time Pill & Actions */}
          <div className="flex items-center justify-between md:justify-end gap-3 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-line/60">
            <div
              className={clsx(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border shadow-2xs font-bold text-xs',
                status === 'taken'
                  ? 'bg-teal-500/10 text-teal-700 dark:text-teal-400 border-teal-500/20'
                  : status === 'missed'
                    ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20'
                    : clsx(slot.surface, slot.text, slot.border)
              )}
            >
              <span aria-hidden="true" className="shrink-0">{slot.icon(14)}</span>
              <time data-numeric className="whitespace-nowrap">
                {formatDoseTime(scheduledMinutes)}
              </time>
            </div>

            {!readOnly && (
              <div className="flex items-center gap-2">
                {isActionable ? (
                  <>
                    <Button
                      variant="primary"
                      size="md"
                      onClick={onTake}
                      leftIcon={<CheckIcon size={16} />}
                      className={clsx(
                        'h-9 sm:h-10 px-4 sm:px-5 font-bold tap-spring shadow-sm text-xs sm:text-sm whitespace-nowrap',
                        status === 'missed'
                          ? 'bg-amber-600 hover:bg-amber-700 border-amber-600'
                          : 'bg-teal-600 hover:bg-teal-700 border-teal-600'
                      )}
                    >
                      {status === 'missed' ? 'Take Overdue' : 'Take Dose'}
                    </Button>
                    <Button
                      variant="secondary"
                      size="md"
                      onClick={onSkip}
                      className="h-9 sm:h-10 px-3 text-xs font-semibold tap-spring whitespace-nowrap"
                    >
                      Skip
                    </Button>
                  </>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-teal-700 dark:text-teal-400 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />
                      {status === 'taken' ? 'Taken' : 'Skipped'}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={onUndo}
                      className="text-xs text-content-muted hover:text-content font-semibold h-8 px-2"
                    >
                      Undo
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {instructions && (
          <div className="text-xs text-content-muted bg-surface-sunken/80 border border-line/60 rounded-xl px-3.5 py-2 leading-relaxed flex items-start gap-2">
            <FileText size={14} className="text-accent shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-content block text-[11px]">Special Instructions:</span>
              <span>{instructions}</span>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}
