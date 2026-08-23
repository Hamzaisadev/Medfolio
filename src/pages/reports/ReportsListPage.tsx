import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceArea,
} from 'recharts';
import { AppShell } from '../../components/layout/AppShell';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { Disclaimer } from '../../components/ui/Disclaimer';
import { LabFlaskIcon } from '../../components/ui/icons';
import { reportsRepo, testOrdersRepo } from '../../lib/db';
import type { Tables } from '../../lib/supabase/types';
import { REPORT_OUT_OF_RANGE_NOTE } from '../../lib/disclaimer';

import { useAuth } from '../../lib/auth/AuthContext';

type ReportWithResults = Tables<'reports'> & {
  report_results?: Tables<'report_results'>[];
};

export function ReportsListPage() {
  const { user, profile } = useAuth();
  const [reports, setReports] = useState<ReportWithResults[]>([]);
  const [pendingOrders, setPendingOrders] = useState<Tables<'test_orders'>[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTrendTest, setSelectedTrendTest] = useState<string>('');
  const [expandedReportId, setExpandedReportId] = useState<string | null>(null);

  const effectiveUserId = user?.id || profile?.user_id || '';
  const effectiveProfileId = profile?.id || effectiveUserId;

  const loadData = useCallback(async () => {
    if (!effectiveProfileId) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const [repList, orderList] = await Promise.all([
        reportsRepo.listReports(effectiveProfileId),
        testOrdersRepo.listPendingTestOrders(effectiveProfileId),
      ]);

      // Load full results for each report
      const fullReports = await Promise.all(
        repList.map(async (r) => {
          const results = await reportsRepo.listResultsForReport(r.id);
          return { ...r, report_results: results };
        })
      );

      setReports(fullReports);
      setPendingOrders(orderList);

      // Pre-select first numeric test for trend visualizer if available
      if (fullReports.length > 0) {
        const allTestNames = new Set<string>();
        for (const rep of fullReports) {
          for (const res of rep.report_results || []) {
            if (res.value_numeric !== null) {
              allTestNames.add(res.test_name);
            }
          }
        }
        const firstTest = Array.from(allTestNames)[0];
        if (firstTest) {
          setSelectedTrendTest(firstTest);
        }
      }
    } catch (err) {
      console.error('Failed to load reports:', err);
      setLoadError('Your lab reports could not be loaded. Check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  }, [effectiveProfileId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filtered reports
  const filteredReports = useMemo(() => {
    if (!searchQuery.trim()) return reports;
    const q = searchQuery.toLowerCase();
    return reports.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        (r.lab_name && r.lab_name.toLowerCase().includes(q)) ||
        (r.report_results &&
          r.report_results.some((res) => res.test_name.toLowerCase().includes(q)))
    );
  }, [reports, searchQuery]);

  // Distinct test names for trend picker
  const availableTrendTests = useMemo(() => {
    const names = new Set<string>();
    for (const r of reports) {
      for (const res of r.report_results || []) {
        if (res.value_numeric !== null) {
          names.add(res.test_name);
        }
      }
    }
    return Array.from(names);
  }, [reports]);

  // Trend Chart Data preparation
  const trendData = useMemo(() => {
    if (!selectedTrendTest) return { points: [], units: new Set<string>(), minRef: null, maxRef: null };

    const points: Array<{
      date: string;
      value: number;
      unit: string;
      rawDate: string;
    }> = [];
    const units = new Set<string>();
    let minRef: number | null = null;
    let maxRef: number | null = null;

    // Sort reports chronologically
    const sorted = [...reports].sort((a, b) => a.report_date.localeCompare(b.report_date));

    for (const rep of sorted) {
      for (const res of rep.report_results || []) {
        if (
          res.test_name.toLowerCase() === selectedTrendTest.toLowerCase() &&
          res.value_numeric !== null
        ) {
          const unitStr = res.unit || '';
          if (unitStr) units.add(unitStr);

          points.push({
            date: rep.report_date,
            value: res.value_numeric,
            unit: unitStr,
            rawDate: rep.report_date,
          });

          // Extract reference numbers if present
          if (res.ref_low !== null && res.ref_high !== null) {
            minRef = res.ref_low;
            maxRef = res.ref_high;
          } else if (res.reference_range) {
            const rangeMatch = res.reference_range.match(/([\d.]+)\s*-\s*([\d.]+)/);
            if (rangeMatch && rangeMatch[1] && rangeMatch[2]) {
              minRef = parseFloat(rangeMatch[1]);
              maxRef = parseFloat(rangeMatch[2]);
            }
          }
        }
      }
    }

    return { points, units, minRef, maxRef };
  }, [reports, selectedTrendTest]);

  // Outside typical range count
  const outsideRangeCount = useMemo(() => {
    let count = 0;
    for (const rep of reports) {
      for (const res of rep.report_results || []) {
        if (res.range_status === 'below' || res.range_status === 'above') count++;
      }
    }
    return count;
  }, [reports]);

  return (
    <AppShell>
      <PageHeader
        title="Lab Reports & Diagnostics"
        description="View past blood work, culture reports, pathology results, and track biometric trends over time."
        action={
          <Link to="/reports/new">
            <Button leftIcon={<LabFlaskIcon size={18} />}>Add Lab Report</Button>
          </Link>
        }
      />

      {loadError ? (
        <ErrorState
          title="Reports didn't load"
          message={loadError}
          onRetry={loadData}
          className="mb-6"
        />
      ) : (
        <>
          {/* Summary KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <Card className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-content-subtle uppercase tracking-wider">Total Reports</p>
                <p className="text-2xl font-bold text-content mt-1">{reports.length}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-accent-subtle flex items-center justify-center text-accent">
                <LabFlaskIcon size={20} />
              </div>
            </Card>

            <Card className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-content-subtle uppercase tracking-wider">Outside Range</p>
                <p className="text-2xl font-bold text-warn-text mt-1">{outsideRangeCount}</p>
              </div>
              <Badge tone={outsideRangeCount > 0 ? 'warn' : 'ok'}>
                {outsideRangeCount > 0 ? 'Review values' : 'All within range'}
              </Badge>
            </Card>

            <Card className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-content-subtle uppercase tracking-wider">Pending Orders</p>
                <p className="text-2xl font-bold text-content mt-1">{pendingOrders.length}</p>
              </div>
              {pendingOrders.length > 0 ? (
                <Badge tone="info">{pendingOrders.length} test{pendingOrders.length > 1 ? 's' : ''} to do</Badge>
              ) : (
                <Badge tone="ok">Up to date</Badge>
              )}
            </Card>
          </div>

          {/* Pending Doctor Test Orders Alert Banner */}
          {pendingOrders.length > 0 && (
            <div className="mb-6 p-4 rounded-[var(--radius-lg)] border border-info-border bg-info-bg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-info-bg border border-info-border flex items-center justify-center text-info-text shrink-0">
                  <LabFlaskIcon size={16} />
                </div>
                <div>
                  <p className="text-sm font-bold text-info-text">
                    You have {pendingOrders.length} pending test order{pendingOrders.length > 1 ? 's' : ''} from doctor visits
                  </p>
                  <p className="text-xs text-info-text">
                    {pendingOrders.map((o) => o.test_name).join(', ')}
                  </p>
                </div>
              </div>
              <Link to="/reports/new" state={{ linkedOrderId: pendingOrders[0]?.id }}>
                <Button variant="primary" size="sm">
                  Upload Report
                </Button>
              </Link>
            </div>
          )}

          {/* Historical Test Trend Visualizer */}
          {availableTrendTests.length > 0 && (
            <Card
              className="mb-8"
              header={
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-bold text-content">Biomarker Trend Visualizer</h2>
                    <p className="text-xs text-content-subtle">Track changes across historic blood work and lab tests</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <label htmlFor="trend-test-select" className="text-xs text-content-subtle font-medium">Select Parameter:</label>
                    <select
                      id="trend-test-select"
                      value={selectedTrendTest}
                      onChange={(e) => setSelectedTrendTest(e.target.value)}
                      className="h-9 px-3 text-xs bg-surface border border-line rounded-md font-semibold text-content focus:outline-none focus:ring-2 focus:ring-accent"
                    >
                      {availableTrendTests.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              }
            >
              {trendData.points.length > 0 ? (
                <div className="space-y-4">
                  {/* Unit Mismatch Check */}
                  {trendData.units.size > 1 && (
                    <div className="p-2.5 rounded-md border border-warn-border bg-warn-bg text-xs text-warn-text flex items-center gap-2">
                      <span className="font-bold">⚠️ Different Units Detected:</span>
                      <span>Results use multiple units ({Array.from(trendData.units).join(', ')}). Comparing across different units may not be linear.</span>
                    </div>
                  )}

                  <div className="h-64 w-full pt-2 text-content-subtle">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={trendData.points} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.3} />
                        <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'currentColor' }} />
                        <YAxis tick={{ fontSize: 11, fill: 'currentColor' }} domain={['auto', 'auto']} />
                        <Tooltip
                          content={({ active, payload, label }) => {
                            if (active && payload && payload.length && payload[0]) {
                              const p = payload[0].payload;
                              return (
                                <div className="bg-surface-raised border border-line text-content p-2.5 rounded-lg text-xs shadow-lg space-y-1">
                                  <p className="font-bold">{label}</p>
                                  <p className="text-accent">
                                    {selectedTrendTest}: <span className="font-bold text-content">{p.value} {p.unit}</span>
                                  </p>
                                  {trendData.minRef !== null && trendData.maxRef !== null && (
                                    <p className="text-2xs text-content-subtle">
                                      Typical Range: {trendData.minRef} - {trendData.maxRef} {p.unit}
                                    </p>
                                  )}
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        {/* Shaded Reference Area if range numbers exist */}
                        {trendData.minRef !== null && trendData.maxRef !== null && (
                          <ReferenceArea
                            y1={trendData.minRef}
                            y2={trendData.maxRef}
                            fill="#0d9488"
                            fillOpacity={0.08}
                            stroke="#0d9488"
                            strokeDasharray="4 4"
                          />
                        )}
                        <Line
                          type="monotone"
                          dataKey="value"
                          stroke="#0d9488"
                          strokeWidth={3}
                          dot={{ r: 5, fill: '#0f766e', strokeWidth: 2, stroke: '#ffffff' }}
                          activeDot={{ r: 7 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="flex items-center justify-between text-xs text-content-subtle pt-2 border-t border-line">
                    <span>{trendData.points.length} recorded data point{trendData.points.length > 1 ? 's' : ''}</span>
                    {trendData.minRef !== null && trendData.maxRef !== null && (
                      <span className="flex items-center gap-1.5 font-medium text-accent">
                        <span className="w-3 h-3 rounded-xs bg-accent-subtle border border-accent inline-block" />
                        Shaded band represents typical reference range ({trendData.minRef} - {trendData.maxRef})
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-content-muted py-6 text-center">
                  No numeric data points available for {selectedTrendTest}.
                </p>
              )}
            </Card>
          )}

          {/* Reports Feed & Search Header */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-4">
            <h2 className="text-lg font-bold text-content">All Diagnostic Reports ({filteredReports.length})</h2>
            <div className="w-full sm:w-64">
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search reports or tests..."
                aria-label="Search reports or tests"
              />
            </div>
          </div>

          {/* Reports List */}
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-28 w-full" />
              <Skeleton className="h-28 w-full" />
              <Skeleton className="h-28 w-full" />
            </div>
          ) : filteredReports.length === 0 ? (
            <EmptyState
              heading={searchQuery ? 'No matching reports found' : 'No lab reports recorded'}
              description={
                searchQuery
                  ? 'Try adjusting your search terms or filter criteria.'
                  : 'Add your first blood test, pathology report, or radiology summary.'
              }
              action={
                <Link to="/reports/new">
                  <Button size="sm">Add Lab Report</Button>
                </Link>
              }
            />
          ) : (
            <div className="space-y-4">
              {filteredReports.map((report) => {
                const isExpanded = expandedReportId === report.id;
                const resultsList = report.report_results || [];
                const outCount = resultsList.filter(
                  (r) => r.range_status === 'below' || r.range_status === 'above'
                ).length;

                return (
                  <Card key={report.id} className="transition-all hover:border-line-strong">
                    <div className="p-5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2.5">
                            <span className="font-bold text-base text-content">{report.title}</span>
                            {outCount > 0 ? (
                              <Badge tone="warn" size="sm">{outCount} outside typical range</Badge>
                            ) : (
                              <Badge tone="ok" size="sm">Within range</Badge>
                            )}
                          </div>
                          <p className="text-xs text-content-subtle">
                            {report.lab_name ? `${report.lab_name} • ` : ''}Report Date: {report.report_date}
                          </p>
                        </div>

                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => setExpandedReportId(isExpanded ? null : report.id)}
                            className="text-xs font-bold text-accent hover:text-accent-hover underline"
                          >
                            {isExpanded ? 'Hide test table' : `View ${resultsList.length} test result${resultsList.length > 1 ? 's' : ''}`}
                          </button>
                        </div>
                      </div>

                      {/* Results preview pills */}
                      {!isExpanded && resultsList.length > 0 && (
                        <div className="mt-4 flex flex-wrap gap-2 pt-3 border-t border-line">
                          {resultsList.slice(0, 5).map((r) => {
                            const isOut = r.range_status === 'below' || r.range_status === 'above';
                            return (
                              <span
                                key={r.id}
                                className={`text-xs px-2.5 py-1 rounded-md border ${
                                  isOut
                                    ? 'border-warn-border bg-warn-bg text-warn-text font-semibold'
                                    : 'border-line bg-surface text-content-muted'
                                }`}
                              >
                                {r.test_name}: <span className="font-bold">{r.value_text}</span> {r.unit || ''}
                              </span>
                            );
                          })}
                          {resultsList.length > 5 && (
                            <span className="text-xs text-content-subtle py-1">+{resultsList.length - 5} more</span>
                          )}
                        </div>
                      )}

                      {/* Expanded Full Results Table */}
                      {isExpanded && (
                        <div className="mt-5 pt-4 border-t border-line overflow-x-auto">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="border-b border-line text-content-subtle font-semibold uppercase tracking-wider">
                                <th className="pb-2">Test Parameter</th>
                                <th className="pb-2">Observed Value</th>
                                <th className="pb-2">Unit</th>
                                <th className="pb-2">Reference Range</th>
                                <th className="pb-2">Evaluation</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-line">
                              {resultsList.map((res) => {
                                const isOut = res.range_status === 'below' || res.range_status === 'above';
                                return (
                                  <tr key={res.id} className="hover:bg-surface-hover/50">
                                    <td className="py-2.5 font-bold text-content">{res.test_name}</td>
                                    <td className={`py-2.5 font-bold ${isOut ? 'text-warn-text' : 'text-content'}`}>
                                      {res.value_text}
                                    </td>
                                    <td className="py-2.5 text-content-muted">{res.unit || '—'}</td>
                                    <td className="py-2.5 text-content-subtle">{res.reference_range || '—'}</td>
                                    <td className="py-2.5">
                                      {isOut ? (
                                        <Badge tone="warn" size="sm">Outside range</Badge>
                                      ) : (
                                        <Badge tone="ok" size="sm">Within range</Badge>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      <div className="mt-8">
        <Disclaimer text={REPORT_OUT_OF_RANGE_NOTE} />
      </div>
    </AppShell>
  );
}
