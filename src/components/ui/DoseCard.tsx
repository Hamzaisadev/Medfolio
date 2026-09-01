import { clsx } from 'clsx';
import { Button } from './Button';
import { Badge } from './Badge';
import { SLOT_META, mealRelationIcon } from './slotMeta';
import { CheckIcon } from './icons';
import { bucketOf } from '../../domain/timeBuckets';
import { mealRelationOf, mealRelationInstruction } from '../../domain/mealRelation';
import { formatDoseTime } from '../../lib/time';
import { Package, AlertCircle } from 'lucide-react';

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
 * A single scheduled dose card with elevated clinical hierarchy, meal relation tags,
 * cabinet stock tracking, and responsive action triggers.
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
      {/* Slot rail: colours the card by time of day */}
      <span
        className={clsx(
          'absolute inset-y-0 left-0 w-1.5 shadow-sm transition-all',
          status === 'taken' ? 'bg-teal-500' : status === 'missed' ? 'bg-amber-500' : slot.surface
        )}
        aria-hidden="true"
      />

      <div className="pl-5 pr-4.5 py-4.5 sm:py-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3
                className={clsx(
                  'text-base font-bold tracking-tight text-content',
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

            {/* Strength & Dosage Badges */}
            <div className="mt-1.5 flex items-center gap-2 flex-wrap text-xs text-content-muted">
              {strength && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-surface-sunken border border-line text-content font-semibold text-[11px]">
                  {strength}
                </span>
              )}
              {doseAmount && (
                <span className="text-content-muted font-medium">
                  {doseAmount}
                </span>
              )}
              {!strength && !doseAmount && (
                <span className="text-content-subtle italic">Dose as prescribed</span>
              )}
            </div>
          </div>

          {/* Time Pill Badge */}
          <div
            className={clsx(
              'shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-line shadow-2xs transition-colors',
              status === 'taken'
                ? 'bg-teal-500/10 text-teal-700 dark:text-teal-400 border-teal-500/20'
                : status === 'missed'
                  ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20'
                  : clsx(slot.surface, slot.text)
            )}
          >
            <span aria-hidden="true" className="shrink-0">{slot.icon(14)}</span>
            <time className="text-xs font-bold whitespace-nowrap tracking-tight" data-numeric>
              {formatDoseTime(scheduledMinutes)}
            </time>
          </div>
        </div>

        {/* Meal Relation Guidance Chip */}
        <div className="mt-3 flex items-center gap-2 flex-wrap text-xs">
          <div
            className={clsx(
              'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium',
              relation === 'with_food'
                ? 'bg-amber-500/10 border-amber-500/20 text-amber-800 dark:text-amber-300'
                : relation === 'empty_stomach'
                  ? 'bg-blue-500/10 border-blue-500/20 text-blue-800 dark:text-blue-300'
                  : 'bg-surface-sunken border-line text-content-muted'
            )}
          >
            <span className="shrink-0" aria-hidden="true">
              {mealRelationIcon(relation, 13)}
            </span>
            <span>{mealRelationInstruction(withFood)}</span>
          </div>

          {/* Cabinet stock tracking chip */}
          {typeof remaining === 'number' && (
            <div
              className={clsx(
                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold',
                isLowStock
                  ? 'bg-rose-500/10 border-rose-500/20 text-rose-700 dark:text-rose-400 animate-pulse'
                  : 'bg-surface-sunken border-line text-content-subtle'
              )}
            >
              {isLowStock ? <AlertCircle size={13} /> : <Package size={13} />}
              <span>
                {isLowStock ? `Low stock: ${remaining} left` : `${remaining} left in cabinet`}
              </span>
            </div>
          )}
        </div>

        {/* Special Instructions */}
        {instructions && (
          <p className="mt-2.5 text-xs text-content-muted bg-surface-sunken/80 border border-line-strong/60 rounded-xl px-3 py-2 leading-relaxed">
            <span className="font-semibold text-content block text-[11px] mb-0.5">Instructions:</span>
            {instructions}
          </p>
        )}

        {/* Action Buttons */}
        {!readOnly && (
          <div className="mt-4 pt-3 border-t border-line/70 flex items-center justify-between gap-2.5">
            {isActionable ? (
              <>
                <Button
                  variant="primary"
                  size="md"
                  onClick={onTake}
                  leftIcon={<CheckIcon size={16} />}
                  className="flex-1 h-10 font-bold tap-spring shadow-sm"
                >
                  {status === 'missed' ? 'Take overdue dose' : 'Take dose'}
                </Button>
                <Button
                  variant="secondary"
                  size="md"
                  onClick={onSkip}
                  className="h-10 text-xs font-semibold tap-spring px-4"
                >
                  Skip
                </Button>
              </>
            ) : (
              <div className="flex items-center justify-between w-full">
                <span className="text-xs font-medium text-content-subtle flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />
                  {status === 'taken' ? 'Completed for this slot' : 'Marked as skipped'}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onUndo}
                  className="text-xs text-content-muted hover:text-content font-semibold h-8"
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
