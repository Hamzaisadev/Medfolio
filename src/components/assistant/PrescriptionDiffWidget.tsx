import { Badge } from '../ui/Badge';

export interface PrescriptionDiffItem {
  name: string;
  changeType: 'added' | 'adjusted' | 'stopped';
  oldDetail?: string;
  newDetail?: string;
  reason?: string;
}

interface PrescriptionDiffWidgetProps {
  diffs: PrescriptionDiffItem[];
}

export function PrescriptionDiffWidget({ diffs }: PrescriptionDiffWidgetProps) {
  if (!diffs || diffs.length === 0) return null;

  return (
    <div className="my-3 p-4 bg-white border border-teal-200 rounded-2xl shadow-xs space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-teal-900 font-bold text-xs">🔄 Prescription Differential ("What Changed?")</span>
          <Badge tone="info" size="sm">{diffs.length} Modifications</Badge>
        </div>
        <span className="text-[11px] text-ink-400">vs Active Cabinet</span>
      </div>

      <div className="space-y-2">
        {diffs.map((d, idx) => {
          const tone = d.changeType === 'added' ? 'ok' : d.changeType === 'adjusted' ? 'warn' : 'neutral';
          const label = d.changeType === 'added' ? '➕ New' : d.changeType === 'adjusted' ? '⚡ Changed' : '🛑 Discontinued';

          return (
            <div
              key={idx}
              className="p-3 rounded-xl border border-ink-100 bg-ink-50/40 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
            >
              <div>
                <div className="flex items-center gap-2">
                  <Badge tone={tone} size="sm">{label}</Badge>
                  <span className="font-bold text-ink-900">{d.name}</span>
                </div>

                <div className="mt-1 text-[11px] text-ink-600 space-y-0.5">
                  {d.oldDetail && d.newDetail ? (
                    <div className="flex items-center gap-2">
                      <span className="line-through text-ink-400">{d.oldDetail}</span>
                      <span>&rarr;</span>
                      <span className="font-bold text-teal-900">{d.newDetail}</span>
                    </div>
                  ) : d.newDetail ? (
                    <p className="text-teal-900 font-medium">{d.newDetail}</p>
                  ) : null}

                  {d.reason && <p className="text-ink-400 italic text-[10px]">{d.reason}</p>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
