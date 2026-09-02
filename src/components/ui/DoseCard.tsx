import React from 'react';
import { clsx } from 'clsx';
import { motion } from 'motion/react';
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
  ChevronRight,
  ShoppingBag,
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
  /** Callback when the patient clicks on the medication card to view details or order/refill */
  onSelect?: () => void;
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
 * Modern Clinical Medication Tile
 * Features chronotherapy slot accents, high-contrast accessible typography,
 * interactive card click-through for details/refills, and tactile action buttons.
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
  onSelect,
  readOnly = false,
  className,
}: DoseCardProps) {
  const slot = SLOT_META[bucketOf(scheduledMinutes)];
  const relation = mealRelationOf(withFood);
  const badge = statusBadge[status];
  const isActionable = status === 'pending' || status === 'missed';
  const isOutOfStock = typeof remaining === 'number' && remaining <= 0;
  const isLowStock = typeof remaining === 'number' && remaining > 0 && remaining <= 5;

  const handleCardClick = () => {
    if (onSelect) {
      onSelect();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === 'Enter' || e.key === ' ') && onSelect) {
      e.preventDefault();
      onSelect();
    }
  };

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      transition={{ type: 'spring', stiffness: 450, damping: 30 }}
      onClick={handleCardClick}
      onKeyDown={handleKeyDown}
      role={onSelect ? 'button' : undefined}
      tabIndex={onSelect ? 0 : undefined}
      aria-label={onSelect ? `${medicineName} - View details and refill options` : undefined}
      className={clsx(
        'group relative flex flex-col justify-between overflow-hidden rounded-2xl border bg-surface-raised p-4 sm:p-4.5 transition-all duration-200 shadow-2xs hover:shadow-card-hover text-left',
        onSelect && 'cursor-pointer focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent',
        status === 'missed'
          ? 'border-amber-300 dark:border-amber-700/60 bg-amber-500/5 hover:border-amber-500'
          : status === 'taken'
            ? 'border-line/60 bg-surface-raised'
            : 'border-line hover:border-line-strong',
        className
      )}
    >
      {/* Top Chronotherapy Slot Color Accent Strip */}
      <span
        className={clsx(
          'absolute top-0 inset-x-0 h-1.5 transition-all',
          status === 'taken' ? 'bg-teal-600' : status === 'missed' ? 'bg-amber-600' : slot.surface
        )}
        aria-hidden="true"
      />

      <div className="space-y-3">
        {/* Top Header: Scheduled Time Pill + Meal / Status Badges */}
        <div className="flex items-center justify-between gap-2">
          {/* Scheduled Time Chip with High-Contrast Accessible Colors */}
          <span
            className={clsx(
              'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-black border shadow-2xs transition-colors',
              status === 'taken'
                ? 'bg-emerald-50 dark:bg-emerald-950/80 text-emerald-950 dark:text-emerald-100 border-emerald-300 dark:border-emerald-700'
                : status === 'missed'
                  ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-950 dark:text-amber-100 border-amber-300 dark:border-amber-700'
                  : 'bg-surface-sunken text-content border-line-strong/60'
            )}
          >
            <span
              aria-hidden="true"
              className={clsx(
                'shrink-0',
                status === 'taken'
                  ? 'text-emerald-800 dark:text-emerald-300'
                  : status === 'missed'
                    ? 'text-amber-900 dark:text-amber-300'
                    : 'text-accent'
              )}
            >
              {slot.icon(13)}
            </span>
            <time data-numeric className="whitespace-nowrap font-black tracking-tight text-inherit">
              {formatDoseTime(scheduledMinutes)}
            </time>
          </span>

          {/* Badges / Meal Guidance */}
          <div className="flex items-center gap-1.5">
            {relation === 'with_food' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700 text-amber-950 dark:text-amber-200 text-[11px] font-bold">
                <Utensils size={11} />
                With Food
              </span>
            )}
            {relation === 'empty_stomach' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-100 dark:bg-blue-950/60 border border-blue-300 dark:border-blue-700 text-blue-950 dark:text-blue-200 text-[11px] font-bold">
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
              <Badge tone={badge.tone} size="sm" withIcon>
                {badge.label}
              </Badge>
            )}

            {onSelect && (
              <ChevronRight
                size={14}
                className="text-content-subtle group-hover:text-accent group-hover:translate-x-0.5 transition-all ml-0.5"
                aria-hidden="true"
              />
            )}
          </div>
        </div>

        {/* Center: Medicine Icon Squircle + Name & Dosage */}
        <div className="flex items-start gap-3 min-w-0 pt-0.5">
          <div
            className={clsx(
              'w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border shadow-2xs transition-transform duration-200 group-hover:scale-105',
              status === 'taken'
                ? 'bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30'
                : status === 'missed'
                  ? 'bg-amber-500/15 text-amber-900 dark:text-amber-200 border-amber-500/30'
                  : 'bg-surface-sunken text-accent border-line'
            )}
          >
            {status === 'taken' ? (
              <CheckCircle2 size={20} className="text-teal-600 dark:text-teal-400" />
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
              {strength ? (
                <>
                  <span className="px-2 py-0.5 rounded-md bg-surface-sunken border border-line text-content font-bold text-[11px]">
                    {strength}
                  </span>
                  {doseAmount && (
                    <span className="text-content-muted font-medium text-[11px]">
                      {doseAmount}
                    </span>
                  )}
                </>
              ) : doseAmount ? (
                <span className="px-2 py-0.5 rounded-md bg-surface-sunken border border-line text-content font-bold text-[11px]">
                  {doseAmount}
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-md bg-surface-sunken border border-line text-content-subtle font-medium text-[11px]">
                  1 dose
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Cabinet Inventory & Routine Schedule Context Strip */}
        <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-surface-sunken/60 border border-line/50 text-xs">
          {typeof remaining === 'number' ? (
            <span
              className={clsx(
                'inline-flex items-center gap-1.5 text-[11px] font-semibold',
                isOutOfStock
                  ? 'text-rose-700 dark:text-rose-400 font-bold'
                  : isLowStock
                    ? 'text-amber-800 dark:text-amber-300 font-bold'
                    : 'text-content-subtle'
              )}
            >
              {isOutOfStock ? (
                <>
                  <AlertCircle size={12} />
                  Pending Purchase (0 in cabinet)
                </>
              ) : isLowStock ? (
                <>
                  <AlertCircle size={12} />
                  Low stock: {remaining} left
                </>
              ) : (
                <>
                  <Package size={12} />
                  {remaining} in cabinet
                </>
              )}
            </span>
          ) : (
            <span className="text-[11px] text-content-subtle">Course active</span>
          )}

          {status === 'skipped' && skippedReason ? (
            <span className="text-[10px] text-content-subtle italic truncate max-w-[120px]">
              Reason: {skippedReason}
            </span>
          ) : onSelect ? (
            <span className="text-[10px] text-accent font-semibold flex items-center gap-0.5">
              <ShoppingBag size={10} />
              Refill / Details
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
                onClick={(e) => {
                  e.stopPropagation();
                  onTake?.();
                }}
                leftIcon={<CheckIcon size={14} />}
                className={clsx(
                  'flex-1 h-9 font-bold tap-spring shadow-2xs text-xs rounded-xl whitespace-nowrap',
                  status === 'missed'
                    ? 'bg-amber-600 hover:bg-amber-700 border-amber-600 text-white'
                    : 'bg-teal-600 hover:bg-teal-700 border-teal-600 text-white'
                )}
              >
                {status === 'missed' ? 'Take Overdue' : 'Take Dose'}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onSkip?.();
                }}
                className="h-9 px-3.5 text-xs text-content-muted hover:text-content font-semibold rounded-xl border border-line tap-spring"
              >
                Skip
              </Button>
            </>
          ) : (
            <div className="flex items-center justify-between w-full">
              <span className="text-xs font-semibold text-teal-700 dark:text-teal-400 flex items-center gap-1.5">
                <CheckCircle2 size={14} className="text-teal-600 dark:text-teal-400" />
                {status === 'taken' ? 'Logged' : 'Skipped'}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onUndo?.();
                }}
                className="text-xs text-content-subtle hover:text-content font-semibold h-8 px-2.5 rounded-lg"
              >
                Undo
              </Button>
            </div>
          )}
        </div>
      )}
    </motion.article>
  );
}
