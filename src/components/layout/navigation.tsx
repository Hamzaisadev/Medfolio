import type { ReactNode } from 'react';
import {
  HomeIcon,
  MedicineIcon,
  StethoscopeIcon,
  SparklesIcon,
  DropletIcon,
  QuestionIcon,
  FileTextIcon,
  LabFlaskIcon,
  WalletIcon,
  AlertTriangleIcon,
  ShareIcon,
  SettingsIcon,
} from '../ui/icons';

export interface NavItem {
  label: string;
  path: string;
  /** One-line explanation, shown in menus and the mobile sheet. */
  description?: string;
  icon: (size: number) => ReactNode;
}

/**
 * Single source of truth for navigation.
 *
 * Previously the desktop header and the mobile bottom bar each carried their own
 * list, and the mobile one was missing entries: the header's "More" dropdown is
 * `hidden md:flex`, the bottom bar's "More" simply navigated to Settings, and
 * Settings did not link every tool — which left `/reports` and `/symptoms`
 * unreachable on a phone, in a mobile-first app. Both navs now render from here.
 */
export const PRIMARY_NAV: NavItem[] = [
  { label: 'Home', path: '/', icon: (s) => <HomeIcon size={s} /> },
  { label: 'Schedule', path: '/medicines', icon: (s) => <MedicineIcon size={s} /> },
  { label: 'Timeline', path: '/timeline', icon: (s) => <StethoscopeIcon size={s} /> },
  { label: 'Shifa AI', path: '/assistant', icon: (s) => <SparklesIcon size={s} /> },
];

export const SECONDARY_NAV: NavItem[] = [
  {
    label: 'Sugar & blood pressure',
    path: '/vitals',
    description: 'Log and track your readings',
    icon: (s) => <DropletIcon size={s} />,
  },
  {
    label: 'Lab reports',
    path: '/reports',
    description: 'Test records and biomarker trends',
    icon: (s) => <LabFlaskIcon size={s} />,
  },
  {
    label: 'Symptom check',
    path: '/symptoms',
    description: 'Emergency red flags and specialist guide',
    icon: (s) => <AlertTriangleIcon size={s} />,
  },
  {
    label: 'Questions for your doctor',
    path: '/doctor/questions',
    description: 'Prepare for your next visit',
    icon: (s) => <QuestionIcon size={s} />,
  },
  {
    label: 'Doctors & visits',
    path: '/doctors',
    description: 'Consultation history and advice',
    icon: (s) => <StethoscopeIcon size={s} />,
  },
  {
    label: 'Second opinion pack',
    path: '/doctor/second-opinion',
    description: 'Anonymised bundle to share with a specialist',
    icon: (s) => <FileTextIcon size={s} />,
  },
  {
    label: 'Spending',
    path: '/finances',
    description: 'Medicine and consultation costs',
    icon: (s) => <WalletIcon size={s} />,
  },
  {
    label: 'Share your record',
    path: '/share',
    description: 'Time-limited link with a PIN',
    icon: (s) => <ShareIcon size={s} />,
  },
  {
    label: 'Settings',
    path: '/settings',
    description: 'Profile, reminders and appearance',
    icon: (s) => <SettingsIcon size={s} />,
  },
];

/**
 * Whether a nav path should render as the current location.
 *
 * `/` has to match exactly — `startsWith('/')` is true for every route.
 */
export function isNavItemActive(path: string, pathname: string): boolean {
  if (path === '/') return pathname === '/';
  return pathname === path || pathname.startsWith(`${path}/`);
}
