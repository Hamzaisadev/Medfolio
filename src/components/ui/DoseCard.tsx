import { clsx } from 'clsx';
import { motion } from 'motion/react';
import { Button } from './Button';
import { Badge } from './Badge';
import { SLOT_META, mealRelationIcon } from './slotMeta';
import { CheckIcon, MedicineIcon, ClockIcon, AlertTriangleIcon } from './icons';
import { bucketOf } from '../../domain/timeBuckets';
import { mealRelationOf, mealRelationInstruction } from '../../domain/mealRelation';
import { formatDoseTime } from '../../lib/time';

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

const statusBadge: Record<DoseStatus, { tone: 'ok' | 'warn' | 'neutral' | 'info'; label: string } | null> = {
  pending: null,
  taken: { tone: 'ok', label: 'Taken' },
  missed: { tone: 'warn', label: 'Overdue' },
  skipped: { tone: 'neutral', label: 'Skipped' },
};

/**
 * Modern tactile DoseCard with rich clinical details, meal relation pill, and direct 1-tap logging.
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
  const isOverdue = status === 'missed';

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      transition={{ type: 'spring', stiffness: 450, damping: 30 }}
      className={clsx(
        'relative overflow-hidden rounded-[var(--radius-xl)] border transition-all duration-[var(--duration-base)]',
        isOverdue
          ? 'border-warn-border bg-warn-bg/20 shadow-card'
          : status === 'taken'
            ? 'border-ok-border/60 bg-surface-raised/80 opacity-90 shadow-xs'
            : 'border-line hover:border-line-strong bg-surface-raised shadow-card hover:shadow-raise',
        className
      )}
    >
      {/* Time-of-day Slot Rail */}
      <span
        className={clsx(
          'absolute inset-y-0 left-0 w-1.5 transition-colors',
          status === 'taken' ? 'bg-ok-text/40' : isOverdue ? 'bg-warn-text' : slot.surface
        )}
        aria-hidden="true"
      />

      <div className="pl-5 pr-4 py-4 sm:py-4.5">
        <div className="flex items-start justify-between gap-3">
          {/* Left: Medicine Details */}
          <div className="flex items-start gap-3 min-w-0 flex-1">
            {/* Pill/Medicine Icon Container */}
            <div
              className={clsx(
                'shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-colors mt-0.5',
                status === 'taken'
                  ? 'bg-ok-bg text-ok-text border border-ok-border'
                  : isOverdue
                    ? 'bg-warn-bg text-warn-text border border-warn-border'
                    : 'bg-surface-sunken text-accent border border-line'
              )}
            >
              {status === 'taken' ? (
                <CheckIcon size={20} className="stroke-[2.5]" />
              ) : isOverdue ? (
                <AlertTriangleIcon size={18} />
              ) : (
                <MedicineIcon size={19} />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3
                  className={clsx(
                    'text-base font-bold tracking-tight transition-colors truncate',
                    status === 'taken' ? 'text-content-muted line-through decoration-content-subtle/50' : 'text-content'
                  )}
                >
                  {medicineName}
                </h3>
                {badge && (
                  <Badge tone={badge.tone} size="sm" withIcon>
                    {status === 'taken' && <CheckIcon size={11} className="inline mr-0.5" />}
                    {badge.label}
                    {status === 'skipped' && skippedReason ? `: ${skippedReason}` : ''}
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-2 flex-wrap mt-0.5 text-xs text-content-muted">
                <span className="font-medium">
                  {[strength, doseAmount].filter(Boolean).join(' · ') || 'Dose as prescribed'}
                </span>
                {typeof remaining === 'number' && (
                  <>
                    <span>•</span>
                    <span
                      className={clsx(
                        'font-medium',
                        remaining <= 5 ? 'text-warn-text font-bold' : 'text-content-subtle'
                      )}
                      data-numeric
                    >
                      {remaining} left in cabinet
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Right: Scheduled Time Badge */}
          <div
            className={clsx(
              'shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-colors',
              status === 'taken'
                ? 'bg-surface-sunken text-content-muted border-line'
                : isOverdue
                  ? 'bg-warn-bg text-warn-text border-warn-border'
                  : clsx(slot.surface, slot.text, slot.border)
            )}
          >
            <ClockIcon size={13} className="shrink-0 opacity-80" />
            <time data-numeric className="whitespace-nowrap font-mono">
              {formatDoseTime(scheduledMinutes)}
            </time>
          </div>
        </div>

        {/* Meal Guidance & Instructions */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span
            className={clsx(
              'inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border font-medium transition-colors',
              relation === 'unspecified'
                ? 'bg-surface-sunken text-content-subtle border-line'
                : 'bg-surface-hover text-content-muted border-line'
            )}
          >
            <span aria-hidden="true" className="text-accent">
              {mealRelationIcon(relation, 13)}
            </span>
            <span>{mealRelationInstruction(withFood)}</span>
          </span>
        </div>

        {instructions && (
          <p className="mt-2.5 text-xs text-content-muted bg-surface-sunken/80 border border-line rounded-lg px-3 py-2 leading-relaxed">
            <span className="font-semibold text-content">Directions: </span>
            {instructions}
          </p>
        )}

        {/* Action Controls */}
        {!readOnly && (
          <div className="mt-4 flex items-center gap-2 pt-2 border-t border-line/60">
            {isActionable ? (
              <>
                <Button
                  variant="primary"
                  size="md"
                  onClick={onTake}
                  leftIcon={<CheckIcon size={16} />}
                  className="flex-1 font-bold shadow-xs hover:shadow-md"
                >
                  Take now
                </Button>
                <Button variant="secondary" size="md" onClick={onSkip} className="font-medium">
                  Skip
                </Button>
              </>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={onUndo}
                className="text-xs text-content-subtle hover:text-content font-medium ml-auto"
              >
                Undo action
              </Button>
            )}
          </div>
        )}
      </div>
    </motion.article>
  );
}
