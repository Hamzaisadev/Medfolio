import React, { useState } from 'react';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'motion/react';
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
  Utensils,
  Droplets,
  HelpCircle,
  FileText,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ShoppingBag,
  Info,
  RotateCcw,
} from 'lucide-react';

export type DoseStatus = 'pending' | 'taken' | 'skipped' | 'missed';

export interface DoseCardProps {
  medicineId?: string;
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
  /** Callback when the patient clicks to view details or trigger order/refill */
  onSelect?: () => void;
  /** Secondary action callback to order/refill this medication */
  onOrderRefill?: () => void;
  /** Secondary action callback to view the full medication monograph/details */
  onViewDetails?: () => void;
  /** Disables actions, e.g. while browsing a past date. */
  readOnly?: boolean;
  /** Optional controlled expansion state */
  isExpanded?: boolean;
  /** Optional callback when expanded state changes */
  onToggleExpand?: () => void;
  className?: string;
}

const statusBadge: Record<DoseStatus, { tone: 'ok' | 'warn' | 'neutral' | 'info'; label: string } | null> = {
  pending: null,
  taken: { tone: 'ok', label: 'Taken' },
  missed: { tone: 'warn', label: 'Overdue' },
  skipped: { tone: 'neutral', label: 'Skipped' },
};

/**
 * Modern Clinical Medication Accordion Item
 * Features scannable single-line collapsed row with primary "Log Taken" action,
 * and a smooth expandable drawer revealing "Order Refill", "View Details", and inventory count.
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
  onOrderRefill,
  onViewDetails,
  readOnly = false,
  isExpanded: controlledExpanded,
  onToggleExpand,
  className,
}: DoseCardProps) {
  const [internalExpanded, setInternalExpanded] = useState(false);
  const isExpanded = controlledExpanded !== undefined ? controlledExpanded : internalExpanded;

  const slot = SLOT_META[bucketOf(scheduledMinutes)];
  const relation = mealRelationOf(withFood);
  const badge = statusBadge[status];
  const isActionable = status === 'pending' || status === 'missed';
  const isOutOfStock = typeof remaining === 'number' && remaining <= 0;
  const isLowStock = typeof remaining === 'number' && remaining > 0 && remaining <= 5;

  const toggleExpand = () => {
    if (onToggleExpand) {
      onToggleExpand();
    } else {
      setInternalExpanded((prev) => !prev);
    }
  };

  const handleRowClick = () => {
    toggleExpand();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      // Ignore if event target is an interactive button inside
      if ((e.target as HTMLElement).tagName === 'BUTTON') {
        return;
      }
      e.preventDefault();
      toggleExpand();
    }
  };

  const handleRefillClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onOrderRefill) {
      onOrderRefill();
    } else if (onSelect) {
      onSelect();
    }
  };

  const handleViewDetailsClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onViewDetails) {
      onViewDetails();
    } else if (onSelect) {
      onSelect();
    }
  };

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 450, damping: 30 }}
      className={clsx(
        'group relative overflow-hidden rounded-2xl border bg-surface-raised transition-all duration-200 shadow-2xs hover:shadow-card-hover text-left',
        isExpanded && 'ring-1 ring-accent/25 shadow-sm',
        status === 'missed'
          ? 'border-amber-300 dark:border-amber-700/60 bg-amber-500/5 hover:border-amber-500'
          : status === 'taken'
            ? 'border-line/60 bg-surface-raised'
            : 'border-line hover:border-line-strong',
        className
      )}
    >
      {/* Left Chronotherapy Slot Vertical Accent Line */}
      <span
        className={clsx(
          'absolute top-0 bottom-0 left-0 w-1.5 transition-all',
          status === 'taken' ? 'bg-teal-600' : status === 'missed' ? 'bg-amber-600' : slot.surface
        )}
        aria-hidden="true"
      />

      {/* Collapsed Row Header (Single Scannable Line) */}
      <div
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        aria-label={`${medicineName}, ${formatDoseTime(scheduledMinutes)}. Click to ${isExpanded ? 'collapse' : 'expand'} details and refill options.`}
        onClick={handleRowClick}
        onKeyDown={handleKeyDown}
        className={clsx(
          'cursor-pointer select-none pl-4.5 sm:pl-5 pr-3.5 sm:pr-4 py-3 sm:py-3.5 flex items-center justify-between gap-3 min-h-[64px] focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent',
          isExpanded && 'bg-surface-sunken/30'
        )}
      >
        {/* Left Side: Scheduled Time + Medicine Name & Dosage */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {/* Scheduled Time Chip */}
          <span
            className={clsx(
              'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-black border shadow-2xs shrink-0 transition-colors',
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
              {status === 'taken' ? (
                <CheckCircle2 size={13} className="text-teal-600 dark:text-teal-400" />
              ) : status === 'missed' ? (
                <AlertCircle size={13} className="text-amber-600 dark:text-amber-400" />
              ) : (
                slot.icon(13)
              )}
            </span>
            <time data-numeric className="whitespace-nowrap font-black tracking-tight text-inherit">
              {formatDoseTime(scheduledMinutes)}
            </time>
          </span>

          {/* Medicine Name and Dosage summary */}
          <div className="min-w-0 flex-1 flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-2.5">
            <h3
              className={clsx(
                'text-sm sm:text-base font-bold text-content leading-snug tracking-tight truncate',
                status === 'taken' && 'line-through text-content-muted decoration-teal-500/50'
              )}
              title={medicineName}
            >
              {medicineName}
            </h3>

            {/* Dosage & Metadata pills */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {strength && (
                <span className="px-2 py-0.5 rounded-md bg-surface-sunken border border-line text-content font-bold text-[11px]">
                  {strength}
                </span>
              )}
              {doseAmount && (
                <span className="text-content-muted font-medium text-[11px] truncate">
                  {doseAmount}
                </span>
              )}
              {badge && (
                <span className="hidden sm:inline-flex">
                  <Badge tone={badge.tone} size="sm" withIcon>
                    {badge.label}
                  </Badge>
                </span>
              )}
              {relation === 'with_food' && (
                <span className="hidden md:inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-300 text-[10px] font-bold">
                  <Utensils size={10} />
                  With Food
                </span>
              )}
              {relation === 'empty_stomach' && (
                <span className="hidden md:inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 text-blue-900 dark:text-blue-300 text-[10px] font-bold">
                  <Droplets size={10} />
                  Empty Stomach
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Primary "Log Taken" Action & Expand Chevron */}
        <div className="flex items-center gap-2 shrink-0">
          {!readOnly && isActionable && (
            <Button
              variant="primary"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onTake?.();
              }}
              leftIcon={<CheckIcon size={14} />}
              className={clsx(
                'h-8 sm:h-9 px-3 sm:px-4 text-xs font-bold rounded-xl whitespace-nowrap tap-spring shadow-2xs cursor-pointer',
                status === 'missed'
                  ? 'bg-amber-600 hover:bg-amber-700 border-amber-600 text-white'
                  : 'bg-teal-600 hover:bg-teal-700 border-teal-600 text-white'
              )}
            >
              {status === 'missed' ? 'Log Overdue' : 'Log Taken'}
            </Button>
          )}

          {!readOnly && status === 'taken' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-teal-500/10 text-teal-700 dark:text-teal-400 text-xs font-bold border border-teal-500/20">
              <CheckCircle2 size={13} className="text-teal-600 dark:text-teal-400" />
              <span className="hidden sm:inline">Logged</span>
            </span>
          )}

          {!readOnly && status === 'skipped' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-surface-sunken text-content-muted text-xs font-bold border border-line">
              <XCircle size={13} />
              <span className="hidden sm:inline">Skipped</span>
            </span>
          )}

          {/* Expand/Collapse Chevron Indicator */}
          <div
            className={clsx(
              'w-7 h-7 rounded-lg flex items-center justify-center text-content-subtle hover:text-content hover:bg-surface-hover transition-transform duration-200',
              isExpanded && 'rotate-180 text-accent'
            )}
            aria-hidden="true"
          >
            <ChevronDown size={16} />
          </div>
        </div>
      </div>

      {/* Expanded State (Downward Revealing Drawer) */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            key="accordion-drawer"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="px-4.5 sm:px-5 pb-4 pt-2.5 border-t border-line/60 space-y-3.5 bg-surface-sunken/20">
              {/* Context Row: Inventory Count & Meal / Clinical Guidelines */}
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                {/* Current Inventory Count */}
                <div className="flex items-center gap-2">
                  {typeof remaining === 'number' ? (
                    <span
                      className={clsx(
                        'inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold border shadow-2xs',
                        isOutOfStock
                          ? 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20'
                          : isLowStock
                            ? 'bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/20'
                            : 'bg-surface-sunken text-content border-line'
                      )}
                    >
                      {isOutOfStock ? (
                        <>
                          <AlertCircle size={13} className="text-rose-600 dark:text-rose-400" />
                          Out of stock (0 left in cabinet)
                        </>
                      ) : isLowStock ? (
                        <>
                          <AlertCircle size={13} className="text-amber-600 dark:text-amber-400" />
                          Low stock: {remaining} remaining
                        </>
                      ) : (
                        <>
                          <Package size={13} className="text-content-subtle" />
                          {remaining} in cabinet inventory
                        </>
                      )}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-surface-sunken text-content-subtle border border-line text-xs font-medium">
                      <Package size={13} />
                      Course active
                    </span>
                  )}

                  {/* Meal Guidance Pill */}
                  {relation === 'with_food' && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700 text-amber-950 dark:text-amber-200 text-xs font-bold">
                      <Utensils size={12} />
                      Take with Food
                    </span>
                  )}
                  {relation === 'empty_stomach' && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-blue-100 dark:bg-blue-950/60 border border-blue-300 dark:border-blue-700 text-blue-950 dark:text-blue-200 text-xs font-bold">
                      <Droplets size={12} />
                      Empty Stomach
                    </span>
                  )}
                  {relation === 'unspecified' && !badge && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-surface-sunken border border-line text-content-subtle text-xs font-medium">
                      <HelpCircle size={12} />
                      As directed by physician
                    </span>
                  )}
                </div>

                {/* Status or Reason summary */}
                {status === 'skipped' && skippedReason && (
                  <span className="text-xs text-content-subtle italic">
                    Reason: {skippedReason}
                  </span>
                )}
              </div>

              {/* Special Clinical Instructions (if present) */}
              {instructions && (
                <div className="text-xs text-content-muted bg-surface-sunken border border-line/60 rounded-xl px-3 py-2 flex items-start gap-2 leading-relaxed">
                  <FileText size={14} className="text-accent shrink-0 mt-0.5" />
                  <span>{instructions}</span>
                </div>
              )}

              {/* Secondary Actions Row: Order Refill, View Details, Skip & Undo */}
              <div className="pt-1 flex flex-wrap items-center justify-between gap-2.5">
                {/* Secondary Feature Buttons: Order Refill & View Details */}
                <div className="flex items-center gap-2 flex-wrap">
                  {(onOrderRefill || onSelect) && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleRefillClick}
                      leftIcon={<ShoppingBag size={13} />}
                      className="h-8 px-3 text-xs font-bold rounded-xl border border-line text-content hover:text-accent tap-spring shadow-2xs cursor-pointer"
                    >
                      Order Refill
                    </Button>
                  )}

                  {(onViewDetails || onSelect) && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleViewDetailsClick}
                      leftIcon={<Info size={13} />}
                      className="h-8 px-3 text-xs font-bold rounded-xl border border-line text-content hover:text-accent tap-spring shadow-2xs cursor-pointer"
                    >
                      View Details
                    </Button>
                  )}
                </div>

                {/* Contextual actions: Skip Dose or Undo */}
                {!readOnly && (
                  <div className="flex items-center gap-2">
                    {isActionable && onSkip && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSkip();
                        }}
                        className="h-8 px-2.5 text-xs text-content-muted hover:text-content font-semibold rounded-lg cursor-pointer"
                      >
                        Skip Dose
                      </Button>
                    )}

                    {!isActionable && onUndo && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onUndo();
                        }}
                        leftIcon={<RotateCcw size={12} />}
                        className="h-8 px-2.5 text-xs text-content-subtle hover:text-content font-semibold rounded-lg cursor-pointer"
                      >
                        Undo
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
}
