import { clsx } from 'clsx';
import type { Achievement, AchievementIcon } from '../../domain/achievements';
import {
  TrendingUpIcon,
  MedalIcon,
  HeartPulseIcon,
  CheckCircleIcon,
  FileTextIcon,
  DropletIcon,
} from './icons';

export interface MilestoneBadgeCardProps {
  achievement: Achievement;
}

/** Maps the domain's icon key to a real stroked icon. */
function iconFor(icon: AchievementIcon, size: number) {
  switch (icon) {
    case 'streak':
      return <TrendingUpIcon size={size} />;
    case 'trophy':
      return <MedalIcon size={size} />;
    case 'target':
      return <DropletIcon size={size} />;
    case 'heart':
      return <HeartPulseIcon size={size} />;
    case 'trend':
      return <TrendingUpIcon size={size} />;
    case 'archive':
      return <FileTextIcon size={size} />;
  }
}

const tierText: Record<Achievement['badgeLevel'], string> = {
  bronze: 'text-tier-bronze',
  silver: 'text-tier-silver',
  gold: 'text-tier-gold',
  platinum: 'text-tier-platinum',
};

const tierBorder: Record<Achievement['badgeLevel'], string> = {
  bronze: 'border-tier-bronze/40',
  silver: 'border-tier-silver/40',
  gold: 'border-tier-gold/50',
  platinum: 'border-tier-platinum/45',
};

export function MilestoneBadgeCard({ achievement }: MilestoneBadgeCardProps) {
  const { unlocked, badgeLevel } = achievement;

  return (
    <div
      className={clsx(
        'p-4 rounded-[var(--radius-lg)] border bg-surface-raised',
        'transition-[border-color,box-shadow] duration-[var(--duration-base)]',
        unlocked
          ? [tierBorder[badgeLevel], 'shadow-card']
          : 'border-line border-dashed bg-surface-sunken/60'
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={clsx(
            'shrink-0 flex items-center justify-center w-11 h-11 rounded-[var(--radius-md)] border',
            unlocked
              ? [tierBorder[badgeLevel], tierText[badgeLevel], 'bg-surface']
              : 'border-line text-content-subtle bg-surface'
          )}
        >
          {iconFor(achievement.icon, 20)}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h4
              className={clsx(
                'text-sm font-bold truncate',
                unlocked ? 'text-content' : 'text-content-muted'
              )}
            >
              {achievement.title}
            </h4>

            {unlocked ? (
              <span className="shrink-0 inline-flex items-center gap-1 text-2xs font-bold uppercase tracking-wide text-ok-text">
                <CheckCircleIcon size={12} />
                Earned
              </span>
            ) : (
              <span className="shrink-0 text-2xs font-semibold text-content-subtle" data-numeric>
                {achievement.progressLabel}
              </span>
            )}
          </div>

          <p className="text-xs text-content-muted mt-1 leading-snug">{achievement.description}</p>

          {!unlocked && (
            <div
              className="mt-2.5 w-full bg-surface-hover rounded-full h-1.5 overflow-hidden"
              role="progressbar"
              aria-valuenow={achievement.progress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${achievement.title} progress`}
            >
              <div
                className="bg-accent h-full rounded-full transition-[width] duration-[var(--duration-slow)] ease-[var(--ease-out-soft)]"
                style={{ width: `${achievement.progress}%` }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
