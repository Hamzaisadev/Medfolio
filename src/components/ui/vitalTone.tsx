import type { ReactNode } from 'react';
import type { VitalTone } from '../../domain/vitals';
import type { BadgeTone } from './Badge';
import { CheckCircleIcon, AlertTriangleIcon, AlertCircleIcon } from './icons';

/**
 * Maps a clinical severity tone to presentation.
 *
 * The single place `VitalTone` becomes colour. `critical` deliberately maps to the
 * same palette as `risk` but is kept distinct so it can carry extra emphasis —
 * a hypertensive crisis and a mildly high fasting glucose must not look alike.
 */
export interface VitalToneStyles {
  badge: BadgeTone;
  /** Card rail accent. */
  accent: 'ok' | 'warn' | 'risk';
  text: string;
  surface: string;
  border: string;
  icon: (size: number) => ReactNode;
  /** True for readings that need action now. */
  urgent: boolean;
}

export const VITAL_TONE: Record<VitalTone, VitalToneStyles> = {
  ok: {
    badge: 'ok',
    accent: 'ok',
    text: 'text-ok-text',
    surface: 'bg-ok-bg',
    border: 'border-ok-border',
    icon: (s) => <CheckCircleIcon size={s} />,
    urgent: false,
  },
  warn: {
    badge: 'warn',
    accent: 'warn',
    text: 'text-warn-text',
    surface: 'bg-warn-bg',
    border: 'border-warn-border',
    icon: (s) => <AlertTriangleIcon size={s} />,
    urgent: false,
  },
  risk: {
    badge: 'risk',
    accent: 'risk',
    text: 'text-risk-text',
    surface: 'bg-risk-bg',
    border: 'border-risk-border',
    icon: (s) => <AlertCircleIcon size={s} />,
    urgent: false,
  },
  critical: {
    badge: 'risk',
    accent: 'risk',
    text: 'text-risk-text',
    surface: 'bg-risk-bg',
    border: 'border-risk-border',
    icon: (s) => <AlertCircleIcon size={s} />,
    urgent: true,
  },
};
