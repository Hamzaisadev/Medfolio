import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
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
import { Select } from '../../components/ui/Select';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { Disclaimer } from '../../components/ui/Disclaimer';
import { LabFlaskIcon, AlertTriangleIcon } from '../../components/ui/icons';
import { reportsRepo, testOrdersRepo } from '../../lib/db';
import type { Tables } from '../../lib/supabase/types';
import { REPORT_OUT_OF_RANGE_NOTE } from '../../lib/disclaimer';
import { getStandardTestName, areTestsEquivalent } from '../../domain/testAliases';
import { useAuth } from '../../lib/auth/AuthContext';
import { staggerContainer, staggerItem } from '../../lib/motion';

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

      const fullReports = await Promise.all(
        repList.map(async (r) => {
          const results = await reportsRepo.listResultsForReport(r.id);
          return { ...r, report_results: results };
        })
      );

      setReports(fullReports);
      setPendingOrders(orderList);

      if (fullReports.length > 0) {
        const allTestNames = new Set<string>();
        for (const rep of fullReports) {
          for (const res of rep.report_results || []) {
            if (res.value_numeric !== null) {
              const std = getStandardTestName(res.test_name) || res.test_name;
              if (std) allTestNames.add(std);
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

  const filteredReports = useMemo(() => {
    if (!searchQuery.trim()) return reports;
    const q = searchQuery.toLowerCase();
    return reports.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.lab_name?.toLowerCase().includes(q) ||
        r.report_results?.some(
          (res) =>
            res.test_name.toLowerCase().includes(q) ||
            getStandardTestName(res.test_name).toLowerCase().includes(q)
        )
    );
  }, [reports, searchQuery]);

  const numericTestOptions = useMemo(() => {
    const map = new Map<string, number>();
    for (const rep of reports) {
      for (const res of rep.report_results || []) {
        if (res.value_numeric !== null) {
          const stdName = getStandardTestName(res.test_name) || res.test_name;
          map.set(stdName, (map.get(stdName) || 0) + 1);
        }
      }
    }
    return Array.from(map.entries()).map(([name, count]) => ({
      value: name,
      label: `${name} (${count} reading${count > 1 ? 's' : ''})`,
    }));
  }, [reports]);

  // Keep selected test in sync if options change
  useEffect(() => {
    if (numericTestOptions.length > 0) {
      const exists = numericTestOptions.some((opt) => opt.value === selectedTrendTest);
      if (!exists && numericTestOptions[0]) {
        setSelectedTrendTest(numericTestOptions[0].value);
      }
    }
  }, [numericTestOptions, selectedTrendTest]);

  const trendData = useMemo(() => {
    if (!selectedTrendTest) return { points: [], minRef: null, maxRef: null, unit: '' };

    const points: Array<{ date: string; value: number; unit: string; rangeText?: string }> = [];
    let minRef: number | null = null;
    let maxRef: number | null = null;
    let unit = '';

    const sortedReports = [...reports].sort((a, b) => a.report_date.localeCompare(b.report_date));

    for (const rep of sortedReports) {
      const match = rep.report_results?.find(
        (r) =>
          r.value_numeric !== null &&
          (getStandardTestName(r.test_name) === selectedTrendTest ||
           areTestsEquivalent(r.test_name, selectedTrendTest))
      );
      if (match && match.value_numeric !== null) {
        points.push({
          date: rep.report_date,
          value: match.value_numeric,
          unit: match.unit || '',
          rangeText: match.reference_range || undefined,
        });
        if (match.unit) unit = match.unit;
        if (match.reference_range && minRef === null && maxRef === null) {
          const parts = match.reference_range.match(/([0-9.]+)\s*-\s*([0-9.]+)/);
          if (parts && parts[1] && parts[2]) {
            minRef = parseFloat(parts[1]);
            maxRef = parseFloat(parts[2]);
          }
        }
      }
    }

    return { points, minRef, maxRef, unit };
  }, [reports, selectedTrendTest]);

  return (
    <AppShell>
      <PageHeader
        title="Lab Reports & Diagnostic Trends"
        description="Comprehensive diagnostic record archive and longitudinal biomarker trend analysis."
        action={
          <Link to="/reports/new">
            <Button leftIcon={<LabFlaskIcon size={17} />}>Add Lab Report</Button>
          </Link>
        }
      />

      {loadError ? (
        <ErrorState title="Reports didn't load" message={loadError} onRetry={loadData} />
      ) : (
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="space-y-6"
        >
          {/* Pending Test Orders Alert Banner */}
          {pendingOrders.length > 0 && (
            <motion.div variants={staggerItem}>
              <Card accent="warn">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="shrink-0 flex items-center justify-center w-10 h-10 rounded-[var(--radius-md)] bg-warn-bg text-warn-text">
                      <AlertTriangleIcon size={20} />
                    </span>
                    <div>
                      <p className="text-sm font-bold text-content">
                        {pendingOrders.length} Pending Test Order{pendingOrders.length > 1 ? 's' : ''}
                      </p>
                      <p className="text-xs text-content-muted">
                        Prescribed tests awaiting your lab results: {pendingOrders.map((o) => o.test_name).join(', ')}
                      </p>
                    </div>
                  </div>
                  <Link to="/reports/new" className="shrink-0">
                    <Button size="sm" variant="secondary">Upload Test Results</Button>
                  </Link>
                </div>
              </Card>
            </motion.div>
          )}

          {/* Biomarker Trend Visualizer */}
          {numericTestOptions.length > 0 && (
            <motion.div variants={staggerItem}>
              <Card className="p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                  <div>
                    <h2 className="text-base font-bold text-content flex items-center gap-2">
                      <LabFlaskIcon size={18} className="text-accent" />
                      Biomarker Longitudinal Trend
                    </h2>
                    <p className="text-xs text-content-muted mt-0.5">
                      Visualizing your biomarker progression across reports over time.
                    </p>
                  </div>

                  <div className="w-full sm:w-64">
                    <Select
                      value={selectedTrendTest}
                      onValueChange={setSelectedTrendTest}
                      options={numericTestOptions}
                      aria-label="Select biomarker test"
                    />
                  </div>
                </div>

                {trendData.points.length > 0 ? (
                  <div className="space-y-3">
                    <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={trendData.points} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.15} />
                          <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'currentColor' }} />
                          <YAxis tick={{ fontSize: 11, fill: 'currentColor' }} domain={['auto', 'auto']} />
                          <Tooltip
                            content={({ active, payload, label }) => {
                              if (active && payload && payload.length && payload[0]) {
                                const p = payload[0].payload;
                                return (
                                  <div className="bg-surface-raised border border-line text-content p-2.5 rounded-xl text-xs shadow-over space-y-1">
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
                          {trendData.minRef !== null && trendData.maxRef !== null && (
                            <ReferenceArea
                              y1={trendData.minRef}
                              y2={trendData.maxRef}
                              fill="var(--accent)"
                              fillOpacity={0.08}
                              stroke="var(--accent)"
                              strokeDasharray="4 4"
                            />
                          )}
                          <Line
                            type="monotone"
                            dataKey="value"
                            stroke="var(--accent)"
                            strokeWidth={3}
                            dot={{ r: 5, fill: 'var(--accent)', strokeWidth: 2, stroke: '#ffffff' }}
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
            </motion.div>
          )}

          {/* Reports Feed & Search Header */}
          <motion.div variants={staggerItem} className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-4">
            <h2 className="text-lg font-bold text-content">All Diagnostic Reports ({filteredReports.length})</h2>
            <div className="w-full sm:w-64">
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search reports or tests..."
                aria-label="Search reports or tests"
              />
            </div>
          </motion.div>

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
                  <motion.div
                    key={report.id}
                    variants={staggerItem}
                    layout
                    whileHover={{ y: -2 }}
                    transition={{ type: 'spring', stiffness: 450, damping: 30 }}
                  >
                    <Card className="transition-all hover:border-line-strong shadow-card">
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
                              className="text-xs font-bold text-accent hover:text-accent-hover underline cursor-pointer"
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
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="mt-5 pt-4 border-t border-line overflow-x-auto"
                            >
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
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>
      )}

      <div className="mt-8">
        <Disclaimer text={REPORT_OUT_OF_RANGE_NOTE} />
      </div>
    </AppShell>
  );
}
