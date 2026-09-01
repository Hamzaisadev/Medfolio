import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { clsx } from 'clsx';
import { AppShell } from '../../components/layout/AppShell';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Toast } from '../../components/ui/Toast';
import {
  PrescriptionIcon,
  MedicineIcon,
  LabFlaskIcon,
  StethoscopeIcon,
  AlertTriangleIcon,
  PrinterIcon,
  TrashIcon,
} from '../../components/ui/icons';
import {
  Search,
  X,
  ShieldCheck,
  Calendar,
  Layers,
  ArrowRight,
  TrendingUp,
  FileText,
  Filter,
} from 'lucide-react';
import { visitsRepo, reportsRepo, medicinesRepo, sideEffectsRepo } from '../../lib/db';
import { todayInAppTz } from '../../lib/time';
import { useAuth } from '../../lib/auth/AuthContext';
import type { Tables } from '../../lib/supabase/types';

type TimelineEventType = 'visit' | 'report' | 'medicine' | 'side_effect';

interface TimelineItem {
  id: string;
  type: TimelineEventType;
  date: string;
  title: string;
  subtitle: string;
  tags: string[];
  notes?: string | null;
  cost?: number | null;
  linkUrl?: string;
  raw: Tables<'visits'> | Tables<'reports'> | Tables<'medicines'> | Tables<'side_effects'>;
}

export function TimelinePage() {
  const { user, profile } = useAuth();
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<TimelineItem | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const effectiveUserId = user?.id || profile?.user_id || '';
  const effectiveProfileId = profile?.id || effectiveUserId;

  const loadData = useCallback(async () => {
    if (!effectiveUserId) return;
    setIsLoading(true);
    try {
      const [visits, reports, medicines, sideEffects] = await Promise.all([
        visitsRepo.listVisits(effectiveProfileId),
        reportsRepo.listReports(effectiveProfileId),
        medicinesRepo.listMedicines(effectiveProfileId),
        sideEffectsRepo.listSideEffects(effectiveProfileId),
      ]);

      const timelineList: TimelineItem[] = [];

      // Add Visits
      for (const v of visits) {
        timelineList.push({
          id: `visit-${v.id}`,
          type: 'visit',
          date: v.visit_date,
          title: v.doctor_name ? `Dr. ${v.doctor_name.replace(/^dr\.?\s*/i, '')}` : 'Doctor Visit',
          subtitle: v.clinic_name || 'Clinic / Hospital',
          tags: v.diagnosis ? [v.diagnosis] : [],
          notes: v.doctor_advice || v.notes,
          cost: v.visit_cost,
          linkUrl: `/doctor`,
          raw: v,
        });
      }

      // Add Reports
      for (const r of reports) {
        timelineList.push({
          id: `report-${r.id}`,
          type: 'report',
          date: r.report_date,
          title: r.title,
          subtitle: r.lab_name || 'Diagnostic Laboratory',
          tags: ['Lab Report'],
          notes: null,
          cost: null,
          linkUrl: `/reports`,
          raw: r,
        });
      }

      // Add Medicines
      for (const m of medicines) {
        timelineList.push({
          id: `med-${m.id}`,
          type: 'medicine',
          date: m.start_date,
          title: m.medicine_name,
          subtitle: `${m.strength || ''}${m.strength && m.frequency_code ? ' • ' : ''}${m.frequency_code || m.frequency_raw || 'Daily Course'}`,
          tags: m.is_ongoing ? ['Ongoing'] : m.duration_days ? [`${m.duration_days} days`] : [],
          notes: m.instructions,
          cost: null,
          linkUrl: `/medicines/cabinet`,
          raw: m,
        });
      }

      // Add Side Effects
      for (const s of sideEffects) {
        const effDate = s.occurred_at ? s.occurred_at.split('T')[0] : s.created_at.split('T')[0];
        timelineList.push({
          id: `side-${s.id}`,
          type: 'side_effect',
          date: effDate || todayInAppTz(),
          title: 'Symptom Entry',
          subtitle: s.severity ? `Severity: ${s.severity}` : 'Patient log',
          tags: [s.severity || 'mild'],
          notes: s.note,
          cost: null,
          linkUrl: `/symptoms`,
          raw: s,
        });
      }

      // Sort newest to oldest
      timelineList.sort((a, b) => b.date.localeCompare(a.date));
      setItems(timelineList);
    } catch (err) {
      console.error('Failed to load timeline:', err);
    } finally {
      setIsLoading(false);
    }
  }, [effectiveUserId, effectiveProfileId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Counts for category badges
  const counts = useMemo(() => {
    return {
      all: items.length,
      visit: items.filter((i) => i.type === 'visit').length,
      report: items.filter((i) => i.type === 'report').length,
      medicine: items.filter((i) => i.type === 'medicine').length,
      side_effect: items.filter((i) => i.type === 'side_effect').length,
    };
  }, [items]);

  // Filter & Search
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (filterType !== 'all' && item.type !== filterType) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = item.title.toLowerCase().includes(q);
        const matchesSub = item.subtitle.toLowerCase().includes(q);
        const matchesNotes = item.notes ? item.notes.toLowerCase().includes(q) : false;
        const matchesTags = item.tags.some((t) => t.toLowerCase().includes(q));
        return matchesTitle || matchesSub || matchesNotes || matchesTags;
      }
      return true;
    });
  }, [items, filterType, searchQuery]);

  // Group by Month & Year
  const groupedTimeline = useMemo(() => {
    const groups: Record<string, TimelineItem[]> = {};

    for (const item of filteredItems) {
      const d = new Date(item.date);
      const monthYear = isNaN(d.getTime())
        ? 'Other Records'
        : d.toLocaleString('en-US', { month: 'long', year: 'numeric' });

      if (!groups[monthYear]) {
        groups[monthYear] = [];
      }
      groups[monthYear].push(item);
    }

    return Object.entries(groups);
  }, [filteredItems]);

  // Earliest date for history span
  const historySpan = useMemo(() => {
    if (items.length === 0) return null;
    const oldest = items[items.length - 1]?.date;
    if (!oldest) return null;
    const d = new Date(oldest);
    return isNaN(d.getTime()) ? null : d.toLocaleString('en-US', { month: 'short', year: 'numeric' });
  }, [items]);

  // Delete Action
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;

    try {
      if (deleteTarget.type === 'visit') {
        const v = deleteTarget.raw as Tables<'visits'>;
        await visitsRepo.deleteVisit(v.id);
      } else if (deleteTarget.type === 'report') {
        const r = deleteTarget.raw as Tables<'reports'>;
        await reportsRepo.deleteReport(r.id);
      } else if (deleteTarget.type === 'medicine') {
        const m = deleteTarget.raw as Tables<'medicines'>;
        await medicinesRepo.deleteMedicine(m.id);
      } else if (deleteTarget.type === 'side_effect') {
        const s = deleteTarget.raw as Tables<'side_effects'>;
        await sideEffectsRepo.deleteSideEffect(s.id);
      }

      setToastMessage('Record deleted successfully.');
      setDeleteTarget(null);
      await loadData();
    } catch (err: unknown) {
      console.error('Delete error:', err);
      setToastMessage('Failed to delete record.');
    }
  };

  const getEventStyling = (type: TimelineEventType) => {
    switch (type) {
      case 'visit':
        return {
          icon: <StethoscopeIcon size={16} className="text-teal-700 dark:text-teal-400" />,
          badge: <Badge tone="ok" size="sm">Doctor Visit</Badge>,
        };
      case 'report':
        return {
          icon: <LabFlaskIcon size={16} className="text-blue-700 dark:text-blue-400" />,
          badge: <Badge tone="info" size="sm">Lab Report</Badge>,
        };
      case 'medicine':
        return {
          icon: <MedicineIcon size={16} className="text-purple-700 dark:text-purple-400" />,
          badge: <Badge tone="neutral" size="sm">Prescription</Badge>,
        };
      case 'side_effect':
        return {
          icon: <AlertTriangleIcon size={16} className="text-amber-700 dark:text-amber-400" />,
          badge: <Badge tone="warn" size="sm">Symptom</Badge>,
        };
    }
  };

  return (
    <AppShell>
      {/* Executive Page Header */}
      <PageHeader
        title="Medical Timeline"
        description="Unified chronological log of doctor visits, lab reports, active prescriptions, and symptom records."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Link to="/doctor">
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<PrinterIcon size={15} />}
                className="font-bold tap-spring shadow-2xs"
              >
                Export Dossier PDF
              </Button>
            </Link>
            <Link to="/prescriptions/new">
              <Button
                variant="primary"
                size="sm"
                leftIcon={<PrescriptionIcon size={15} />}
                className="font-bold tap-spring shadow-2xs"
              >
                Add Visit / Rx
              </Button>
            </Link>
          </div>
        }
      />

      {toastMessage && (
        <Toast
          open
          onClose={() => setToastMessage(null)}
          message={toastMessage}
          tone="ok"
        />
      )}

      {/* 2-Panel Responsive Clinical Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Sticky Sidebar (4 cols): Executive Control Deck */}
        <aside className="lg:col-span-4 lg:sticky lg:top-24">
          <Card className="p-6 shadow-card border border-line bg-surface-raised/95 backdrop-blur-md rounded-3xl space-y-6">
            {/* Header: Date / Health Record Profile */}
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-600 dark:text-teal-400 shrink-0 shadow-2xs">
                <TrendingUp size={22} />
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg font-bold text-content tracking-tight">
                    Medical History
                  </h2>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-700 dark:text-teal-400 text-xs font-semibold">
                    <ShieldCheck size={11} />
                    Verified
                  </span>
                </div>

                <p className="mt-1 text-xs text-content-muted leading-relaxed">
                  {historySpan ? `Span: ${historySpan} – Present` : 'Longitudinal health history'}
                </p>
              </div>
            </div>

            {/* 4-Stat KPI Grid (Proportioned 2-Column Grid) */}
            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-line/70">
              <div className="p-3 rounded-2xl bg-surface-sunken border border-line text-center transition-all hover:bg-surface-hover/50">
                <span className="text-[11px] font-semibold text-content-subtle block tracking-wide uppercase">
                  Visits
                </span>
                <span className="text-lg font-black text-content block mt-0.5" data-numeric>
                  {counts.visit}
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-teal-500/5 border border-teal-500/15 text-center transition-all hover:bg-teal-500/10">
                <span className="text-[11px] font-semibold text-teal-700 dark:text-teal-400 block tracking-wide uppercase">
                  Lab Tests
                </span>
                <span className="text-lg font-black text-teal-700 dark:text-teal-400 block mt-0.5" data-numeric>
                  {counts.report}
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-surface-sunken border border-line text-center transition-all hover:bg-surface-hover/50">
                <span className="text-[11px] font-semibold text-content-muted block tracking-wide uppercase">
                  Medicines
                </span>
                <span className="text-lg font-black text-content block mt-0.5" data-numeric>
                  {counts.medicine}
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-center transition-all hover:bg-teal-500/15">
                <span className="text-[11px] font-semibold text-teal-700 dark:text-teal-400 block tracking-wide uppercase">
                  Total
                </span>
                <span className="text-lg font-black text-teal-800 dark:text-teal-300 block mt-0.5" data-numeric>
                  {counts.all}
                </span>
              </div>
            </div>

            {/* Filter and Search Section */}
            <div className="space-y-3 pt-3 border-t border-line/70">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold text-content flex items-center gap-1.5 tracking-wider uppercase">
                  <Filter size={14} className="text-teal-600 dark:text-teal-400" />
                  <span>Filter Records</span>
                </div>
                {filterType !== 'all' && (
                  <button
                    type="button"
                    onClick={() => setFilterType('all')}
                    className="text-[11px] font-bold text-teal-600 hover:underline cursor-pointer"
                  >
                    Reset Filter
                  </button>
                )}
              </div>

              {/* Professional Crisp Search Box */}
              <div className="relative">
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search doctor, medicine, lab..."
                  className="pl-9 pr-8 h-10 text-xs rounded-2xl bg-surface-sunken border border-line"
                />
                <Search size={14} className="absolute left-3 top-3 text-content-subtle pointer-events-none" />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-3 text-content-subtle hover:text-content p-0.5 cursor-pointer"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>

              {/* Clean Vertical Filter List (No Truncation) */}
              <div className="space-y-1.5 pt-1">
                {[
                  { id: 'all', label: 'All Records', count: counts.all, icon: <Layers size={14} /> },
                  { id: 'visit', label: 'Doctor Visits', count: counts.visit, icon: <StethoscopeIcon size={14} /> },
                  { id: 'report', label: 'Lab Reports', count: counts.report, icon: <LabFlaskIcon size={14} /> },
                  { id: 'medicine', label: 'Prescriptions', count: counts.medicine, icon: <MedicineIcon size={14} /> },
                  { id: 'side_effect', label: 'Symptoms', count: counts.side_effect, icon: <AlertTriangleIcon size={14} /> },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setFilterType(tab.id)}
                    className={clsx(
                      'w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition-all tap-spring cursor-pointer border',
                      filterType === tab.id
                        ? 'bg-teal-600 text-white border-teal-600 shadow-xs font-bold'
                        : 'bg-surface-sunken/60 border-line/60 text-content-muted hover:text-content hover:bg-surface-hover hover:border-line'
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className={clsx(filterType === tab.id ? 'text-white' : 'text-teal-600 dark:text-teal-400')}>
                        {tab.icon}
                      </span>
                      <span>{tab.label}</span>
                    </div>
                    <span
                      className={clsx(
                        'px-2 py-0.5 rounded-full text-[11px] font-bold',
                        filterType === tab.id
                          ? 'bg-white/20 text-white'
                          : 'bg-surface-raised border border-line text-content-subtle'
                      )}
                    >
                      {tab.count}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Actions Shortcuts */}
            <div className="pt-3 border-t border-line/70 space-y-2.5">
              <Link to="/reports/new" className="w-full block">
                <Button
                  variant="secondary"
                  size="md"
                  leftIcon={<LabFlaskIcon size={15} />}
                  className="w-full h-11 justify-center text-xs font-bold tap-spring shadow-2xs rounded-2xl"
                >
                  Upload Lab Report
                </Button>
              </Link>
              <div className="flex items-center justify-center gap-1.5 text-[11px] text-content-subtle pt-1">
                <ShieldCheck size={13} className="text-teal-600" />
                <span>EHR Verified Medical Timeline</span>
              </div>
            </div>
          </Card>
        </aside>

        {/* Right Main Stream (8 cols): Chronological Multi-Column Grid */}
        <main className="lg:col-span-8 space-y-7">
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-40 w-full rounded-2xl" />
              ))}
            </div>
          ) : filteredItems.length === 0 ? (
            <EmptyState
              heading={searchQuery ? 'No matching records found' : 'No medical history recorded yet'}
              description={
                searchQuery
                  ? 'Try adjusting your search keywords or switching category filters.'
                  : 'Add your first prescription, doctor consultation, or lab report to begin your chronological dossier.'
              }
              action={
                <Link to="/prescriptions/new">
                  <Button leftIcon={<PrescriptionIcon size={16} />} size="sm" className="tap-spring">
                    Add First Prescription
                  </Button>
                </Link>
              }
            />
          ) : (
            <div className="space-y-7">
              {groupedTimeline.map(([monthGroup, groupItems]) => (
                <section key={monthGroup} aria-labelledby={`month-${monthGroup}`} className="space-y-3.5">
                  {/* Executive Month Header */}
                  <div className="flex items-center justify-between gap-3 px-1 py-1.5 border-b border-line/60 pb-2">
                    <div className="flex items-center gap-2">
                      <Calendar size={14} className="text-teal-600 dark:text-teal-400" />
                      <h2
                        id={`month-${monthGroup}`}
                        className="text-xs font-black uppercase tracking-wider text-content"
                      >
                        {monthGroup}
                      </h2>
                    </div>

                    <span className="text-[11px] font-bold text-content-subtle px-2.5 py-0.5 rounded-lg bg-surface-sunken border border-line">
                      {groupItems.length} {groupItems.length === 1 ? 'event' : 'events'}
                    </span>
                  </div>

                  {/* Multi-Column Proportioned Event Tiles Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {groupItems.map((item) => {
                      const style = getEventStyling(item.type);

                      return (
                        <article
                          key={item.id}
                          className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-line bg-surface-raised p-4 transition-all duration-200 shadow-2xs hover:shadow-card-hover hover:border-line-strong"
                        >
                          <div className="space-y-3">
                            {/* Top Header: Badge + Date & Delete */}
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5">
                                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-surface-sunken border border-line shadow-2xs">
                                  {style.icon}
                                </div>
                                {style.badge}
                              </div>

                              <div className="flex items-center gap-1">
                                <span className="text-[11px] font-bold text-content-subtle px-2 py-0.5 rounded-md bg-surface-sunken border border-line">
                                  {item.date}
                                </span>

                                <button
                                  type="button"
                                  onClick={() => setDeleteTarget(item)}
                                  className="w-7 h-7 rounded-lg flex items-center justify-center text-content-subtle hover:text-rose-600 hover:bg-rose-500/10 transition-colors cursor-pointer"
                                  title="Delete record"
                                >
                                  <TrashIcon size={12} />
                                </button>
                              </div>
                            </div>

                            {/* Center: Title & Subtitle */}
                            <div>
                              <h3
                                className="text-sm font-bold text-content leading-snug tracking-tight truncate"
                                title={item.title}
                              >
                                {item.title}
                              </h3>

                              <p className="text-xs text-content-muted mt-0.5 truncate" title={item.subtitle}>
                                {item.subtitle}
                              </p>

                              {/* Tags Row */}
                              {item.tags.length > 0 && (
                                <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                                  {item.tags.map((tag, idx) => (
                                    <span
                                      key={idx}
                                      className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-surface-sunken border border-line text-content-muted"
                                    >
                                      {tag}
                                    </span>
                                  ))}
                                  {item.cost && (
                                    <span className="text-[10px] font-black text-teal-700 dark:text-teal-400 px-1.5 py-0.5 rounded-md bg-teal-500/10 border border-teal-500/20">
                                      PKR {item.cost.toLocaleString()}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Clinical Notes (if present) */}
                            {item.notes && (
                              <div className="text-[11px] text-content-muted bg-surface-sunken/80 border border-line/60 rounded-xl px-2.5 py-1.5 flex items-start gap-1.5 leading-tight">
                                <FileText size={12} className="text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" />
                                <span className="truncate">{item.notes}</span>
                              </div>
                            )}
                          </div>

                          {/* Bottom Action Footer */}
                          {item.linkUrl && (
                            <div className="mt-3 pt-2.5 border-t border-line/60 flex items-center justify-end">
                              <Link
                                to={item.linkUrl}
                                className="inline-flex items-center gap-1 text-[11px] font-bold text-teal-600 dark:text-teal-400 hover:underline tap-spring"
                              >
                                <span>View Details</span>
                                <ArrowRight size={12} />
                              </Link>
                            </div>
                          )}
                        </article>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}
        </main>
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete Timeline Record"
        description={`Are you sure you want to permanently delete "${deleteTarget?.title}" recorded on ${deleteTarget?.date}? This action cannot be reversed.`}
        requiredPhrase="DELETE"
        tone="danger"
        confirmLabel="Permanently Delete"
        onConfirm={handleDeleteConfirm}
      />
    </AppShell>
  );
}
