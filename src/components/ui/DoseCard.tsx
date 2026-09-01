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
  className?: string;
}

const statusBadge: Record<DoseStatus, { tone: 'ok' | 'warn' | 'neutral'; label: string } | null> = {
  pending: null,
  taken: { tone: 'ok', label: 'Taken' },
  missed: { tone: 'warn', label: 'Overdue' },
  skipped: { tone: 'neutral', label: 'Skipped' },
};

/**
 * Modern Clinical Medication Tile
 * Features chronotherapy slot accents, inline medical attributes,
 * low-stock safety radar, and tactile action buttons.
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
        'group relative flex flex-col justify-between overflow-hidden rounded-2xl border bg-surface-raised p-4 sm:p-4.5 transition-all duration-200 shadow-2xs hover:shadow-card-hover hover:border-line-strong',
        status === 'missed'
          ? 'border-amber-500/40 bg-amber-500/[0.025] ring-1 ring-amber-500/20'
          : status === 'taken'
            ? 'border-teal-500/30 bg-teal-500/[0.015]'
            : 'border-line',
        isSettled && 'opacity-90',
        className
      )}
    >
      {/* Top Chronotherapy Slot Color Accent Strip */}
      <span
        className={clsx(
          'absolute top-0 inset-x-0 h-1 transition-all',
          status === 'taken' ? 'bg-teal-500' : status === 'missed' ? 'bg-amber-500' : slot.surface
        )}
        aria-hidden="true"
      />

      <div className="space-y-3">
        {/* Top Header: Scheduled Time Pill + Meal / Status Badges */}
        <div className="flex items-center justify-between gap-2">
          {/* Scheduled Time Chip */}
          <span
            className={clsx(
              'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold border shadow-2xs',
              status === 'taken'
                ? 'bg-teal-500/10 text-teal-700 dark:text-teal-400 border-teal-500/20'
                : status === 'missed'
                  ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20'
                  : 'bg-surface-sunken text-content border-line'
            )}
          >
            <span aria-hidden="true" className="shrink-0">{slot.icon(13)}</span>
            <time data-numeric className="whitespace-nowrap">
              {formatDoseTime(scheduledMinutes)}
            </time>
          </span>

          {/* Badges / Meal Guidance */}
          <div className="flex items-center gap-1.5">
            {relation === 'with_food' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-[11px] font-semibold">
                <Utensils size={11} />
                With Food
              </span>
            )}
            {relation === 'empty_stomach' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-800 dark:text-blue-300 text-[11px] font-semibold">
                <Droplets size={11} />
                Empty Stomach
              </span>
            )}
            {relation === 'unspecified' && !badge && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-surface-sunken border border-line text-content-subtle text-[11px] font-medium">
                <HelpCircle size={11} />
                As directed
              </span>
            )}

            {badge && (
              <Badge tone={badge.tone} size="sm">
                {badge.label}
              </Badge>
            )}
          </div>
        </div>

        {/* Center: Medicine Icon Squircle + Name & Dosage */}
        <div className="flex items-start gap-3 min-w-0 pt-0.5">
          <div
            className={clsx(
              'w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border shadow-2xs transition-transform duration-200 group-hover:scale-105',
              status === 'taken'
                ? 'bg-teal-500/10 text-teal-600 border-teal-500/20'
                : status === 'missed'
                  ? 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                  : 'bg-surface-sunken text-accent border-line'
            )}
          >
            {status === 'taken' ? (
              <CheckCircle2 size={20} className="text-teal-600" />
            ) : status === 'skipped' ? (
              <XCircle size={20} className="text-content-muted" />
            ) : (
              <Pill size={20} />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <h3
              className={clsx(
                'text-base font-bold text-content leading-snug tracking-tight truncate',
                status === 'taken' && 'line-through text-content-muted decoration-teal-500/50'
              )}
              title={medicineName}
            >
              {medicineName}
            </h3>

            {/* Strength & Dosage metadata */}
            <div className="mt-1 flex items-center gap-1.5 flex-wrap text-xs">
              {strength && (
                <span className="px-1.5 py-0.5 rounded-md bg-surface-sunken border border-line text-content font-bold text-[11px]">
                  {strength}
                </span>
              )}
              {doseAmount && (
                <span className="text-content-muted font-medium text-[11px]">
                  · {doseAmount}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Cabinet Inventory Status Strip */}
        <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-surface-sunken/60 border border-line/50 text-xs">
          {typeof remaining === 'number' ? (
            <span
              className={clsx(
                'inline-flex items-center gap-1 text-[11px] font-semibold',
                isLowStock ? 'text-rose-600 dark:text-rose-400 font-bold animate-pulse' : 'text-content-subtle'
              )}
            >
              {isLowStock ? <AlertCircle size={12} /> : <Package size={12} />}
              {isLowStock ? `Low stock: ${remaining} left` : `${remaining} in cabinet`}
            </span>
          ) : (
            <span className="text-[11px] text-content-subtle">Course active</span>
          )}

          {status === 'skipped' && skippedReason ? (
            <span className="text-[10px] text-content-subtle italic truncate max-w-[120px]">
              Reason: {skippedReason}
            </span>
          ) : (
            <span className="text-[10px] text-content-subtle">PKT Schedule</span>
          )}
        </div>

        {/* Special Instructions (if present) */}
        {instructions && (
          <div className="text-[11px] text-content-muted bg-surface-sunken/80 border border-line/60 rounded-xl px-2.5 py-1.5 flex items-start gap-1.5 leading-tight">
            <FileText size={12} className="text-accent shrink-0 mt-0.5" />
            <span className="truncate">{instructions}</span>
          </div>
        )}
      </div>

      {/* Bottom Action Footer */}
      {!readOnly && (
        <div className="mt-3.5 pt-3 border-t border-line/70 flex items-center justify-between gap-2">
          {isActionable ? (
            <>
              <Button
                variant="primary"
                size="sm"
                onClick={onTake}
                leftIcon={<CheckIcon size={14} />}
                className={clsx(
                  'flex-1 h-9 font-bold tap-spring shadow-2xs text-xs rounded-xl whitespace-nowrap',
                  status === 'missed'
                    ? 'bg-amber-600 hover:bg-amber-700 border-amber-600'
                    : 'bg-teal-600 hover:bg-teal-700 border-teal-600'
                )}
              >
                {status === 'missed' ? 'Take Overdue' : 'Take Dose'}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={onSkip}
                className="h-9 px-3.5 text-xs text-content-muted hover:text-content font-semibold rounded-xl border border-line tap-spring"
              >
                Skip
              </Button>
            </>
          ) : (
            <div className="flex items-center justify-between w-full">
              <span className="text-xs font-semibold text-teal-700 dark:text-teal-400 flex items-center gap-1.5">
                <CheckCircle2 size={14} className="text-teal-600" />
                {status === 'taken' ? 'Logged' : 'Skipped'}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={onUndo}
                className="text-xs text-content-subtle hover:text-content font-semibold h-8 px-2.5 rounded-lg"
              >
                Undo
              </Button>
            </div>
          )}
        </div>
      )}
    </article>
  );
}
