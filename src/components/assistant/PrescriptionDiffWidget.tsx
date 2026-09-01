import { Badge } from '../ui/Badge';
import { PrescriptionIcon } from '../ui/icons';

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
    <div className="my-3 p-3.5 sm:p-4 bg-surface-raised border border-line-strong rounded-2xl shadow-card space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-content font-bold text-xs flex items-center gap-1.5">
            <PrescriptionIcon size={16} className="text-accent shrink-0" /> Prescription Differential ("What Changed?")
          </span>
          <Badge tone="info" size="sm">{diffs.length} Modifications</Badge>
        </div>
        <span className="text-[11px] text-content-muted">vs Active Cabinet</span>
      </div>

      <div className="space-y-2">
        {diffs.map((d, idx) => {
          const tone = d.changeType === 'added' ? 'ok' : d.changeType === 'adjusted' ? 'warn' : 'neutral';
          const label = d.changeType === 'added' ? 'New' : d.changeType === 'adjusted' ? 'Changed' : 'Discontinued';

          return (
            <div
              key={idx}
              className="p-3 rounded-xl border border-line bg-surface-sunken text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
            >
              <div>
                <div className="flex items-center gap-2">
                  <Badge tone={tone} size="sm">{label}</Badge>
                  <span className="font-bold text-content">{d.name}</span>
                </div>

                <div className="mt-1 text-[11px] text-content-muted space-y-0.5">
                  {d.oldDetail && d.newDetail ? (
                    <div className="flex items-center gap-2">
                      <span className="line-through text-content-subtle">{d.oldDetail}</span>
                      <span>&rarr;</span>
                      <span className="font-bold text-content">{d.newDetail}</span>
                    </div>
                  ) : d.newDetail ? (
                    <p className="text-content font-medium">{d.newDetail}</p>
                  ) : null}

                  {d.reason && <p className="text-content-subtle italic text-[10px]">{d.reason}</p>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
