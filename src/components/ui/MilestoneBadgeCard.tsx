import { Achievement } from '../../domain/achievements';

export interface MilestoneBadgeCardProps {
  achievement: Achievement;
}

export function MilestoneBadgeCard({ achievement }: MilestoneBadgeCardProps) {
  const badgeBorder = achievement.unlocked
    ? achievement.badgeLevel === 'platinum'
      ? 'border-indigo-400 bg-linear-to-br from-indigo-50/80 to-white shadow-sm'
      : achievement.badgeLevel === 'gold'
      ? 'border-amber-400 bg-linear-to-br from-amber-50/80 to-white shadow-sm'
      : achievement.badgeLevel === 'silver'
      ? 'border-slate-300 bg-linear-to-br from-slate-50 to-white shadow-xs'
      : 'border-amber-700/30 bg-linear-to-br from-orange-50/50 to-white shadow-xs'
    : 'border-ink-200/60 bg-ink-50/50 opacity-60';

  return (
    <div className={`p-4 rounded-2xl border transition-all ${badgeBorder}`}>
      <div className="flex items-start gap-3">
        <div className="text-2xl p-2 rounded-xl bg-white border border-ink-100 shadow-2xs shrink-0 flex items-center justify-center">
          {achievement.icon}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <h4 className="text-xs font-bold text-ink-900 truncate">{achievement.title}</h4>
            {achievement.unlocked ? (
              <span className="text-[10px] font-black uppercase text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-full border border-emerald-300">
                Unlocked ✓
              </span>
            ) : (
              <span className="text-[10px] font-bold text-ink-400 font-mono">
                {achievement.progressLabel}
              </span>
            )}
          </div>

          <p className="text-[11px] text-ink-600 mt-1 leading-snug">{achievement.description}</p>

          {!achievement.unlocked && (
            <div className="mt-2.5 w-full bg-ink-200/80 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-teal-700 h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${achievement.progress}%` }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
