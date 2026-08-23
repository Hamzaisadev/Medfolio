import { clsx } from 'clsx';
import { Button } from './Button';
import { Badge } from './Badge';
import { SLOT_META, mealRelationIcon } from './slotMeta';
import { CheckIcon } from './icons';
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

const statusBadge: Record<DoseStatus, { tone: 'ok' | 'warn' | 'neutral'; label: string } | null> = {
  pending: null,
  taken: { tone: 'ok', label: 'Taken' },
  missed: { tone: 'warn', label: 'Overdue' },
  skipped: { tone: 'neutral', label: 'Skipped' },
};

/**
 * A single scheduled dose.
 *
 * Deliberately shows meal guidance: `with_food` was recorded on every medicine
 * but never surfaced on the schedule, which is the one screen where a patient is
 * about to take the tablet and needs to know.
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

  return (
    <article
      className={clsx(
        'relative overflow-hidden rounded-[var(--radius-xl)] border bg-surface-raised/95 backdrop-blur-md shadow-card hover:shadow-raise transition-all duration-[var(--duration-base)]',
        status === 'missed' ? 'border-warn-border glow-amber' : 'border-line hover:border-line-strong',
        isSettled && 'opacity-80',
        className
      )}
    >
      {/* Slot rail: colours the card by time of day without tinting the whole
          surface, which stays readable in dark mode. */}
      <span
        className={clsx('absolute inset-y-0 left-0 w-1.5 shadow-sm', slot.surface)}
        aria-hidden="true"
      />

      <div className="pl-5 pr-4 py-4 sm:py-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3
                className={clsx(
                  'text-base font-bold tracking-tight',
                  status === 'taken' ? 'text-content-muted' : 'text-content'
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

            <p className="mt-1 text-sm text-content-muted">
              {[strength, doseAmount].filter(Boolean).join(' · ') || 'Dose as prescribed'}
            </p>
          </div>

          <div
            className={clsx(
              'shrink-0 flex flex-col items-center justify-center gap-0.5 px-3 py-2 rounded-[var(--radius-md)]',
              slot.surface,
              slot.text
            )}
          >
            <span aria-hidden="true">{slot.icon(16)}</span>
            <time className="text-xs font-bold whitespace-nowrap" data-numeric>
              {formatDoseTime(scheduledMinutes)}
            </time>
          </div>
        </div>

        {/* Meal guidance. An unspecified relation is stated as unspecified rather
            than defaulted to a made-up instruction. */}
        <p
          className={clsx(
            'mt-3 flex items-start gap-2 text-sm',
            relation === 'unspecified' ? 'text-content-subtle' : 'text-content-muted'
          )}
        >
          <span className="shrink-0 mt-0.5" aria-hidden="true">
            {mealRelationIcon(relation, 15)}
          </span>
          <span>{mealRelationInstruction(withFood)}</span>
        </p>

        {instructions && (
          <p className="mt-2.5 text-sm text-content-muted bg-surface-sunken border border-line rounded-[var(--radius-md)] px-3 py-2.5 leading-relaxed">
            {instructions}
          </p>
        )}

        {!readOnly && (
          <div className="mt-4 flex items-center gap-2.5">
            {isActionable ? (
              <>
                <Button
                  variant="primary"
                  size="lg"
                  onClick={onTake}
                  leftIcon={<CheckIcon size={18} />}
                  className="flex-1"
                >
                  Take now
                </Button>
                <Button variant="secondary" size="lg" onClick={onSkip}>
                  Skip
                </Button>
              </>
            ) : (
              // Undo, not "mark taken again": re-running the taken path used to
              // decrement the pill count a second time on every click.
              <Button variant="ghost" size="sm" onClick={onUndo}>
                Undo
              </Button>
            )}
          </div>
        )}

        {typeof remaining === 'number' && (
          <p className="mt-2.5 text-xs text-content-subtle" data-numeric>
            {remaining} left in your cabinet
          </p>
        )}
      </div>
    </article>
  );
}
