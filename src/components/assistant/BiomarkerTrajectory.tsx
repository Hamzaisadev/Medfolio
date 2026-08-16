import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import type { Tables } from '../../lib/supabase/types';

interface BiomarkerTrajectoryProps {
  reports: Tables<'reports'>[];
  resultsMap: Record<string, Tables<'report_results'>[]>;
  onAskAssistant?: (query: string) => void;
}

export function BiomarkerTrajectory({
  reports,
  resultsMap,
  onAskAssistant,
}: BiomarkerTrajectoryProps) {
  // Aggregate all results
  const allResults: Array<Tables<'report_results'> & { report_date: string; report_title: string }> = [];

  reports.forEach((r) => {
    const list = resultsMap[r.id] || [];
    list.forEach((res) => {
      allResults.push({
        ...res,
        report_date: r.report_date,
        report_title: r.title,
      });
    });
  });

  const outOfRangeList = allResults.filter((r) => r.range_status === 'above' || r.range_status === 'below');

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="p-4 rounded-2xl bg-teal-900 text-white shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-sm">Longitudinal Biomarker Insights</h3>
          <p className="text-xs text-teal-200">
            Synthesizing {allResults.length} test results across {reports.length} diagnostic reports.
          </p>
        </div>

        {onAskAssistant && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              onAskAssistant(
                'Please summarize the overall trajectory of my lab biomarkers across my diagnostic reports and highlight any values that require attention.'
              )
            }
          >
            Explain Biomarker Trends &rarr;
          </Button>
        )}
      </div>

      {/* Out of Range Attention Card */}
      {outOfRangeList.length > 0 && (
        <Card header={<h3 className="text-sm font-bold text-amber-900">Biomarkers Flagged Outside Typical Range</h3>}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {outOfRangeList.map((res) => (
              <div
                key={res.id}
                className="p-3 rounded-xl border border-amber-200 bg-amber-50/60 text-xs flex flex-col justify-between"
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <span className="font-bold text-ink-900 block">{res.test_name}</span>
                    <span className="text-[10px] text-ink-500">{res.report_title} ({res.report_date})</span>
                  </div>
                  <Badge tone="risk" size="sm">
                    {res.range_status === 'above' ? 'High' : 'Low'}
                  </Badge>
                </div>

                <div className="flex items-baseline justify-between pt-1 border-t border-amber-200/60">
                  <span className="text-sm font-black text-amber-950">
                    {res.value_text} {res.unit || ''}
                  </span>
                  <span className="text-[10px] text-ink-600">Ref: {res.reference_range || 'N/A'}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* All Recent Diagnostic Tests */}
      <Card header={<h3 className="text-sm font-bold text-ink-900">Recent Lab Tests Overview</h3>}>
        {allResults.length === 0 ? (
          <div className="p-6 text-center text-xs text-ink-500 bg-ink-50 rounded-xl">
            No diagnostic lab reports recorded yet. Upload a lab report slip to begin tracking your biomarker trajectory.
          </div>
        ) : (
          <div className="divide-y divide-ink-100">
            {allResults.slice(0, 10).map((res) => (
              <div key={res.id} className="py-3 flex items-center justify-between text-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-ink-900">{res.test_name}</span>
                    <Badge tone={res.range_status === 'within' ? 'ok' : res.range_status === 'unknown' ? 'neutral' : 'risk'} size="sm">
                      {res.range_status === 'within' ? 'Normal' : res.range_status === 'unknown' ? 'Recorded' : res.range_status}
                    </Badge>
                  </div>
                  <span className="text-[11px] text-ink-500">{res.report_title} • {res.report_date}</span>
                </div>

                <div className="text-right">
                  <span className="font-bold text-ink-900 text-sm block">
                    {res.value_text} {res.unit || ''}
                  </span>
                  <span className="text-[10px] text-ink-400">Ref: {res.reference_range || 'N/A'}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
