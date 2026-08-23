import type { ReactNode } from 'react';
import type { Bucket } from '../../domain/timeBuckets';
import { BUCKET_DEFINITIONS } from '../../domain/timeBuckets';
import type { MealRelation } from '../../domain/mealRelation';
import { SunriseIcon, SunIcon, SunsetIcon, MoonIcon, MealIcon, ClockIcon, InfoIcon } from './icons';

/**
 * Presentation metadata for time-of-day buckets.
 *
 * Kept next to the components rather than in `domain/timeBuckets`, so the domain
 * layer stays free of JSX and colour decisions. The bucket boundaries themselves
 * remain the single source of truth in `BUCKET_DEFINITIONS`.
 */
export interface SlotMeta {
  key: Bucket;
  label: string;
  timeRange: string;
  tone: 'morning' | 'afternoon' | 'evening' | 'night';
  icon: (size: number) => ReactNode;
  /** Tailwind classes for a tinted surface in this slot's colour. */
  surface: string;
  text: string;
  border: string;
}

export const SLOT_META: Record<Bucket, SlotMeta> = {
  morning: {
    key: 'morning',
    label: BUCKET_DEFINITIONS.morning.label,
    timeRange: BUCKET_DEFINITIONS.morning.timeRange,
    tone: 'morning',
    icon: (size) => <SunriseIcon size={size} />,
    surface: 'bg-slot-morning-bg',
    text: 'text-slot-morning-text',
    border: 'border-slot-morning-border',
  },
  afternoon: {
    key: 'afternoon',
    label: BUCKET_DEFINITIONS.afternoon.label,
    timeRange: BUCKET_DEFINITIONS.afternoon.timeRange,
    tone: 'afternoon',
    icon: (size) => <SunIcon size={size} />,
    surface: 'bg-slot-afternoon-bg',
    text: 'text-slot-afternoon-text',
    border: 'border-slot-afternoon-border',
  },
  evening: {
    key: 'evening',
    label: BUCKET_DEFINITIONS.evening.label,
    timeRange: BUCKET_DEFINITIONS.evening.timeRange,
    tone: 'evening',
    icon: (size) => <SunsetIcon size={size} />,
    surface: 'bg-slot-evening-bg',
    text: 'text-slot-evening-text',
    border: 'border-slot-evening-border',
  },
  night: {
    key: 'night',
    label: BUCKET_DEFINITIONS.night.label,
    timeRange: BUCKET_DEFINITIONS.night.timeRange,
    tone: 'night',
    icon: (size) => <MoonIcon size={size} />,
    surface: 'bg-slot-night-bg',
    text: 'text-slot-night-text',
    border: 'border-slot-night-border',
  },
};

/** Icon for a meal relation, paired with `mealRelationInstruction` for the text. */
export function mealRelationIcon(relation: MealRelation, size = 14): ReactNode {
  switch (relation) {
    case 'with_food':
      return <MealIcon size={size} />;
    case 'empty_stomach':
      return <ClockIcon size={size} />;
    case 'unspecified':
      return <InfoIcon size={size} />;
  }
}
