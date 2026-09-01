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
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 items-start">
        {/* Left Sticky Sidebar (4 cols): Executive Control Deck */}
        <aside className="lg:col-span-4 lg:sticky lg:top-24">
          <Card bare className="p-4 sm:p-5 shadow-card border border-line bg-surface-raised/95 backdrop-blur-md rounded-3xl space-y-4">
            {/* 1. Header: Health Record Profile */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-600 dark:text-teal-400 shrink-0 shadow-2xs">
                <TrendingUp size={18} />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <h2 className="text-sm font-bold text-content tracking-tight">
                    Medical History
                  </h2>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-700 dark:text-teal-400 text-[10px] font-bold shrink-0">
                    <ShieldCheck size={11} />
                    Verified
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-content-muted">
                  {historySpan ? `Span: ${historySpan} – Present` : 'Longitudinal health history'}
                </p>
              </div>
            </div>

            {/* 2. Unified 4-Column Metric Strip */}
            <div className="pt-3.5 border-t border-line/70">
              <div className="grid grid-cols-4 gap-1 p-2.5 rounded-2xl bg-surface-sunken/80 border border-line text-center">
                <div className="py-0.5">
                  <span className="text-[10px] font-bold text-content-subtle block uppercase tracking-wider">Visits</span>
                  <span className="text-sm font-black text-content block mt-0.5" data-numeric>{counts.visit}</span>
                </div>
                <div className="py-0.5 border-l border-line/60">
                  <span className="text-[10px] font-bold text-content-subtle block uppercase tracking-wider">Labs</span>
                  <span className="text-sm font-black text-content block mt-0.5" data-numeric>{counts.report}</span>
                </div>
                <div className="py-0.5 border-l border-line/60">
                  <span className="text-[10px] font-bold text-content-subtle block uppercase tracking-wider">Meds</span>
                  <span className="text-sm font-black text-content block mt-0.5" data-numeric>{counts.medicine}</span>
                </div>
                <div className="py-0.5 border-l border-line/60">
                  <span className="text-[10px] font-bold text-teal-700 dark:text-teal-400 block uppercase tracking-wider">Total</span>
                  <span className="text-sm font-black text-teal-700 dark:text-teal-400 block mt-0.5" data-numeric>{counts.all}</span>
                </div>
              </div>
            </div>

            {/* 3. Search Box Section */}
            <div className="pt-3.5 border-t border-line/70">
              <div className="relative">
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search doctor, medicine, lab..."
                  className="pl-8.5 pr-8 h-9.5 text-xs rounded-xl bg-surface-sunken border border-line"
                />
                <Search size={13} className="absolute left-2.5 top-3 text-content-subtle pointer-events-none" />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-2.5 text-content-subtle hover:text-content p-0.5 cursor-pointer"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>

            {/* 4. Symmetrical Filter Chips */}
            <div className="space-y-2.5 pt-3.5 border-t border-line/70">
              <div className="flex items-center justify-between text-xs font-bold text-content uppercase tracking-wider">
                <span className="flex items-center gap-1.5">
                  <Filter size={12} className="text-teal-600 dark:text-teal-400" />
                  Filter Records
                </span>
                {filterType !== 'all' && (
                  <button
                    type="button"
                    onClick={() => setFilterType('all')}
                    className="text-xs font-bold text-teal-600 hover:underline cursor-pointer normal-case"
                  >
                    Clear Filter
                  </button>
                )}
              </div>

              {/* Symmetrical Filter Grid */}
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setFilterType('all')}
                  className={clsx(
                    'w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all tap-spring cursor-pointer border',
                    filterType === 'all'
                      ? 'bg-teal-600 text-white border-teal-600 shadow-xs'
                      : 'bg-surface-sunken/60 border-line/60 text-content-muted hover:text-content hover:bg-surface-hover hover:border-line'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className={clsx(filterType === 'all' ? 'text-white' : 'text-teal-600 dark:text-teal-400')}>
                      <Layers size={13} />
                    </span>
                    <span>All Records</span>
                  </div>
                  <span
                    className={clsx(
                      'px-1.5 py-0.2 rounded-full text-[10px] font-black',
                      filterType === 'all'
                        ? 'bg-white/20 text-white'
                        : 'bg-surface-raised border border-line text-content-subtle'
                    )}
                  >
                    {counts.all}
                  </span>
                </button>

                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'visit', label: 'Visits', count: counts.visit, icon: <StethoscopeIcon size={13} /> },
                    { id: 'report', label: 'Labs', count: counts.report, icon: <LabFlaskIcon size={13} /> },
                    { id: 'medicine', label: 'Meds', count: counts.medicine, icon: <MedicineIcon size={13} /> },
                    { id: 'side_effect', label: 'Symptoms', count: counts.side_effect, icon: <AlertTriangleIcon size={13} /> },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setFilterType(tab.id)}
                      className={clsx(
                        'flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-semibold transition-all tap-spring cursor-pointer border',
                        filterType === tab.id
                          ? 'bg-teal-600 text-white border-teal-600 shadow-xs font-bold'
                          : 'bg-surface-sunken/60 border-line/60 text-content-muted hover:text-content hover:bg-surface-hover hover:border-line'
                      )}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className={clsx(filterType === tab.id ? 'text-white' : 'text-teal-600 dark:text-teal-400')}>
                          {tab.icon}
                        </span>
                        <span className="truncate">{tab.label}</span>
                      </div>
                      <span
                        className={clsx(
                          'px-1.5 py-0.2 rounded-full text-[10px] font-black shrink-0 ml-1',
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
            </div>

            {/* 5. Quick Actions Shortcuts */}
            <div className="pt-3.5 border-t border-line/70 space-y-2">
              <Link to="/reports/new" className="w-full block">
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={<LabFlaskIcon size={14} />}
                  className="w-full h-10 justify-center text-xs font-bold tap-spring shadow-2xs rounded-xl"
                >
                  Upload Lab Report
                </Button>
              </Link>
              <div className="flex items-center justify-center gap-1.5 text-[10px] text-content-subtle">
                <ShieldCheck size={12} className="text-teal-600" />
                <span>EHR Verified Medical Timeline</span>
              </div>
            </div>
          </Card>
        </aside>

        {/* Right Main Stream (8 cols): Chronological Multi-Column Grid */}
        <main className="lg:col-span-8 space-y-8">
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            <div className="space-y-8">
              {groupedTimeline.map(([monthGroup, groupItems]) => (
                <section key={monthGroup} aria-labelledby={`month-${monthGroup}`} className="space-y-4">
                  {/* Executive Month Header */}
                  <div className="flex items-center justify-between gap-3 px-1 py-1.5 border-b border-line/60 pb-2.5">
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {groupItems.map((item) => {
                      const style = getEventStyling(item.type);

                      return (
                        <article
                          key={item.id}
                          className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-line bg-surface-raised p-4.5 transition-all duration-200 shadow-2xs hover:shadow-card-hover hover:border-line-strong"
                        >
                          <div className="space-y-3.5">
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

                              <p className="text-xs text-content-muted mt-1 truncate" title={item.subtitle}>
                                {item.subtitle}
                              </p>

                              {/* Tags Row */}
                              {item.tags.length > 0 && (
                                <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
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
                              <div className="text-[11px] text-content-muted bg-surface-sunken/80 border border-line/60 rounded-xl p-2.5 flex items-start gap-1.5 leading-relaxed">
                                <FileText size={12} className="text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" />
                                <span className="truncate">{item.notes}</span>
                              </div>
                            )}
                          </div>

                          {/* Bottom Action Footer */}
                          {item.linkUrl && (
                            <div className="mt-3.5 pt-3 border-t border-line/60 flex items-center justify-end">
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
