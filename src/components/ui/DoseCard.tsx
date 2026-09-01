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
 * Compact, proportioned Clinical Medication Tile
 * Optimized for multi-column chronotherapy grid layouts.
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
        'group relative flex flex-col justify-between overflow-hidden rounded-2xl border bg-surface-raised p-4 transition-all duration-200 shadow-2xs hover:shadow-raise',
        status === 'missed'
          ? 'border-amber-500/40 bg-amber-500/[0.03] ring-1 ring-amber-500/20'
          : status === 'taken'
            ? 'border-teal-500/30 bg-teal-500/[0.015]'
            : 'border-line hover:border-line-strong',
        isSettled && 'opacity-90',
        className
      )}
    >
      {/* Top Accent Strip with Slot Theme */}
      <span
        className={clsx(
          'absolute top-0 inset-x-0 h-1 transition-all',
          status === 'taken' ? 'bg-teal-500' : status === 'missed' ? 'bg-amber-500' : slot.surface
        )}
        aria-hidden="true"
      />

      <div className="space-y-3">
        {/* Top Header: Time Chip & Badges */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          {/* Scheduled Time Chip */}
          <span
            className={clsx(
              'inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-bold border shadow-2xs',
              status === 'taken'
                ? 'bg-teal-500/10 text-teal-700 dark:text-teal-400 border-teal-500/20'
                : status === 'missed'
                  ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20'
                  : 'bg-surface-sunken text-content border-line'
            )}
          >
            <span aria-hidden="true" className="shrink-0">{slot.icon(12)}</span>
            <time data-numeric className="whitespace-nowrap">
              {formatDoseTime(scheduledMinutes)}
            </time>
          </span>

          <div className="flex items-center gap-1.5">
            {/* Meal relation chip */}
            {relation === 'with_food' && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-[10px] font-semibold">
                <Utensils size={10} />
                With Food
              </span>
            )}
            {relation === 'empty_stomach' && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-blue-500/10 border border-blue-500/20 text-blue-800 dark:text-blue-300 text-[10px] font-semibold">
                <Droplets size={10} />
                Empty Stomach
              </span>
            )}

            {badge && (
              <Badge tone={badge.tone} size="sm">
                {badge.label}
              </Badge>
            )}
          </div>
        </div>

        {/* Center: Avatar & Medicine Identity */}
        <div className="flex items-start gap-3 min-w-0">
          <div
            className={clsx(
              'w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border shadow-2xs transition-transform duration-200 group-hover:scale-105',
              status === 'taken'
                ? 'bg-teal-500/10 text-teal-600 border-teal-500/20'
                : status === 'missed'
                  ? 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                  : 'bg-surface-sunken text-accent border-line'
            )}
          >
            {status === 'taken' ? (
              <CheckCircle2 size={18} className="text-teal-600" />
            ) : status === 'skipped' ? (
              <XCircle size={18} className="text-content-muted" />
            ) : (
              <Pill size={18} />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <h3
              className={clsx(
                'text-sm sm:text-base font-bold text-content leading-snug tracking-tight truncate',
                status === 'taken' && 'line-through text-content-muted decoration-teal-500/50'
              )}
              title={medicineName}
            >
              {medicineName}
            </h3>

            <div className="mt-0.5 flex items-center gap-1.5 flex-wrap text-xs text-content-muted">
              {strength && (
                <span className="font-semibold text-content text-xs">
                  {strength}
                </span>
              )}
              {doseAmount && (
                <span className="text-[11px] text-content-subtle">
                  · {doseAmount}
                </span>
              )}
              {relation === 'unspecified' && !strength && (
                <span className="text-[11px] text-content-subtle flex items-center gap-1">
                  <HelpCircle size={10} /> As directed
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Stock & Instructions Metadata */}
        <div className="flex items-center justify-between gap-2 text-xs pt-1 border-t border-line/50">
          {typeof remaining === 'number' ? (
            <span
              className={clsx(
                'inline-flex items-center gap-1 text-[11px] font-semibold',
                isLowStock ? 'text-rose-600 dark:text-rose-400 font-bold animate-pulse' : 'text-content-subtle'
              )}
            >
              {isLowStock ? <AlertCircle size={10} /> : <Package size={10} />}
              {isLowStock ? `Low: ${remaining} left` : `${remaining} in cabinet`}
            </span>
          ) : (
            <span className="text-[11px] text-content-subtle">Scheduled Daily</span>
          )}

          {status === 'skipped' && skippedReason && (
            <span className="text-[10px] text-content-subtle italic truncate max-w-[120px]">
              Reason: {skippedReason}
            </span>
          )}
        </div>

        {instructions && (
          <div className="text-[11px] text-content-muted bg-surface-sunken/60 border border-line/60 rounded-lg px-2.5 py-1.5 flex items-start gap-1.5 leading-tight">
            <FileText size={12} className="text-accent shrink-0 mt-0.5" />
            <span className="truncate">{instructions}</span>
          </div>
        )}
      </div>

      {/* Bottom Action Footer */}
      {!readOnly && (
        <div className="mt-3.5 pt-3 border-t border-line flex items-center justify-between gap-2">
          {isActionable ? (
            <>
              <Button
                variant="primary"
                size="sm"
                onClick={onTake}
                leftIcon={<CheckIcon size={14} />}
                className={clsx(
                  'flex-1 h-8 font-bold tap-spring shadow-2xs text-xs whitespace-nowrap',
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
                className="h-8 px-2.5 text-xs text-content-muted hover:text-content font-semibold tap-spring"
              >
                Skip
              </Button>
            </>
          ) : (
            <div className="flex items-center justify-between w-full">
              <span className="text-xs font-semibold text-teal-700 dark:text-teal-400 flex items-center gap-1">
                <CheckCircle2 size={13} className="text-teal-600" />
                {status === 'taken' ? 'Logged' : 'Skipped'}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={onUndo}
                className="text-xs text-content-subtle hover:text-content font-semibold h-7 px-2"
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
