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
          title: v.doctor_name ? `Doctor Consultation — ${v.doctor_name}` : 'Doctor Consultation',
          subtitle: v.clinic_name || 'Clinic / Hospital Encounter',
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
          subtitle: r.lab_name || 'Diagnostic Laboratory Report',
          tags: ['Diagnostic Lab'],
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
          title: `Prescription Started — ${m.medicine_name}`,
          subtitle: `${m.strength || 'Standard Strength'} • ${m.frequency_code || m.frequency_raw || 'Daily Course'}`,
          tags: m.is_ongoing ? ['Ongoing Regimen'] : m.duration_days ? [`${m.duration_days} days course`] : [],
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
          title: `Clinical Symptom Logged`,
          subtitle: s.severity ? `Recorded Severity: ${s.severity}` : 'Patient symptom entry',
          tags: [s.severity ? `Severity: ${s.severity}` : 'mild'],
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
          icon: <StethoscopeIcon size={18} className="text-teal-600 dark:text-teal-400" />,
          bg: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20',
          badge: <Badge tone="ok" size="sm">Doctor Visit</Badge>,
          accentBar: 'bg-teal-500',
        };
      case 'report':
        return {
          icon: <LabFlaskIcon size={18} className="text-blue-600 dark:text-blue-400" />,
          bg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
          badge: <Badge tone="info" size="sm">Lab Investigation</Badge>,
          accentBar: 'bg-blue-500',
        };
      case 'medicine':
        return {
          icon: <MedicineIcon size={18} className="text-purple-600 dark:text-purple-400" />,
          bg: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
          badge: <Badge tone="neutral" size="sm">Prescription</Badge>,
          accentBar: 'bg-purple-500',
        };
      case 'side_effect':
        return {
          icon: <AlertTriangleIcon size={18} className="text-amber-600 dark:text-amber-400" />,
          bg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
          badge: <Badge tone="warn" size="sm">Symptom Note</Badge>,
          accentBar: 'bg-amber-500',
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
                Export Clinical Dossier PDF
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
            <Link to="/reports/new">
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<LabFlaskIcon size={15} />}
                className="font-bold tap-spring shadow-2xs"
              >
                Upload Lab
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

      {/* Lifetime Clinical Milestone Hero Deck */}
      {!isLoading && items.length > 0 && (
        <Card className="mb-6 p-5 sm:p-6 shadow-sm border border-line glass-card rounded-3xl overflow-hidden relative">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 relative z-10">
            {/* Left: Overall Record Span */}
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent shrink-0 shadow-2xs">
                <TrendingUp size={24} />
              </div>

              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base sm:text-lg font-bold text-content tracking-tight">
                    Longitudinal Health Record
                  </h2>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-700 dark:text-teal-400 text-xs font-semibold">
                    <ShieldCheck size={12} />
                    Verified Timeline
                  </span>
                </div>

                <p className="text-xs text-content-muted mt-0.5">
                  {historySpan
                    ? `Chronological medical records spanning from ${historySpan} to Present.`
                    : `${items.length} health milestones recorded in your medical profile.`}
                </p>
              </div>
            </div>

            {/* Right: 4-Column KPI Stats Deck */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 md:pt-0 border-t md:border-t-0 border-line">
              <div className="p-3 rounded-2xl bg-teal-500/5 border border-teal-500/15 text-center">
                <span className="text-[11px] font-semibold text-teal-700 dark:text-teal-400 block tracking-wide uppercase">
                  Visits
                </span>
                <span className="text-lg font-black text-teal-700 dark:text-teal-400 block mt-0.5" data-numeric>
                  {counts.visit}
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-blue-500/5 border border-blue-500/15 text-center">
                <span className="text-[11px] font-semibold text-blue-700 dark:text-blue-400 block tracking-wide uppercase">
                  Lab Tests
                </span>
                <span className="text-lg font-black text-blue-700 dark:text-blue-400 block mt-0.5" data-numeric>
                  {counts.report}
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-purple-500/5 border border-purple-500/15 text-center">
                <span className="text-[11px] font-semibold text-purple-700 dark:text-purple-400 block tracking-wide uppercase">
                  Medicines
                </span>
                <span className="text-lg font-black text-purple-700 dark:text-purple-400 block mt-0.5" data-numeric>
                  {counts.medicine}
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-surface-sunken border border-line text-center">
                <span className="text-[11px] font-semibold text-content-subtle block tracking-wide uppercase">
                  Total
                </span>
                <span className="text-lg font-black text-content block mt-0.5" data-numeric>
                  {counts.all}
                </span>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Filter and Search Controls Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3.5 mb-6">
        {/* Category Pill Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {[
            { id: 'all', label: 'All History', count: counts.all, icon: <Layers size={13} /> },
            { id: 'visit', label: 'Doctor Visits', count: counts.visit, icon: <StethoscopeIcon size={13} /> },
            { id: 'report', label: 'Lab Reports', count: counts.report, icon: <LabFlaskIcon size={13} /> },
            { id: 'medicine', label: 'Prescriptions', count: counts.medicine, icon: <MedicineIcon size={13} /> },
            { id: 'side_effect', label: 'Symptoms', count: counts.side_effect, icon: <AlertTriangleIcon size={13} /> },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterType(tab.id)}
              className={clsx(
                'inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap tap-spring cursor-pointer border',
                filterType === tab.id
                  ? 'bg-accent text-white border-accent shadow-xs'
                  : 'bg-surface-raised border-line text-content-muted hover:text-content hover:bg-surface-hover'
              )}
            >
              {tab.icon}
              <span>{tab.label}</span>
              <span
                className={clsx(
                  'px-1.5 py-0.2 rounded-full text-[10px] font-extrabold',
                  filterType === tab.id ? 'bg-white/20 text-white' : 'bg-surface-sunken text-content-subtle'
                )}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="w-full md:w-80 relative">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by doctor, lab, diagnosis..."
            className="pl-9 pr-8 h-10 text-xs"
          />
          <Search size={15} className="absolute left-3 top-3 text-content-subtle pointer-events-none" />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-2.5 text-content-subtle hover:text-content p-0.5 rounded cursor-pointer"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Timeline Stream */}
      {isLoading ? (
        <div className="space-y-6">
          <Skeleton className="h-7 w-40 rounded-xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
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
        <div className="space-y-9">
          {groupedTimeline.map(([monthGroup, groupItems]) => (
            <section key={monthGroup} className="space-y-4">
              {/* Executive Month / Year Milestone Header */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-surface-raised border border-line shadow-2xs">
                  <Calendar size={13} className="text-accent" />
                  <span className="text-xs font-black uppercase tracking-wider text-content">
                    {monthGroup}
                  </span>
                  <span className="text-[11px] font-bold text-content-subtle px-2 py-0.2 rounded-md bg-surface-sunken border border-line">
                    {groupItems.length} {groupItems.length === 1 ? 'event' : 'events'}
                  </span>
                </div>
                <div className="h-px bg-line/80 flex-1" />
              </div>

              {/* Connected Chronological Event Cards */}
              <div className="relative pl-3.5 sm:pl-5 border-l-2 border-line/80 ml-3.5 space-y-3.5">
                {groupItems.map((item) => {
                  const style = getEventStyling(item.type);

                  return (
                    <article
                      key={item.id}
                      className="group relative overflow-hidden rounded-2xl border border-line bg-surface-raised/95 backdrop-blur-md p-4 sm:p-5 shadow-2xs hover:shadow-card-hover hover:border-line-strong transition-all duration-200"
                    >
                      {/* Left Accent Rail */}
                      <span
                        className={clsx('absolute inset-y-0 left-0 w-1.5 transition-all', style.accentBar)}
                        aria-hidden="true"
                      />

                      <div className="space-y-3 pl-1 sm:pl-2">
                        {/* Top Header: Icon + Title & Badges + Date & Cost */}
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                          <div className="flex items-start gap-3.5 min-w-0">
                            <div
                              className={clsx(
                                'w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border shadow-2xs transition-transform duration-200 group-hover:scale-105',
                                style.bg
                              )}
                            >
                              {style.icon}
                            </div>

                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="text-sm sm:text-base font-bold text-content tracking-tight">
                                  {item.title}
                                </h3>
                                {style.badge}
                                {item.tags.map((tag, idx) => (
                                  <span
                                    key={idx}
                                    className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-surface-sunken border border-line text-content-muted"
                                  >
                                    {tag}
                                  </span>
                                ))}
                              </div>

                              <p className="text-xs text-content-muted font-medium mt-0.5">
                                {item.subtitle}
                              </p>
                            </div>
                          </div>

                          {/* Right Metadata: Date, Fee & Delete */}
                          <div className="flex items-center gap-2.5 self-start sm:self-auto shrink-0">
                            <span className="text-xs font-bold text-content-subtle px-2.5 py-1 rounded-lg bg-surface-sunken border border-line">
                              {item.date}
                            </span>

                            {item.cost && (
                              <span className="text-xs font-black text-teal-700 dark:text-teal-400 px-2 py-1 rounded-lg bg-teal-500/10 border border-teal-500/20">
                                PKR {item.cost.toLocaleString()}
                              </span>
                            )}

                            <button
                              type="button"
                              onClick={() => setDeleteTarget(item)}
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-content-subtle hover:text-rose-600 hover:bg-rose-500/10 transition-colors cursor-pointer"
                              title="Delete record"
                            >
                              <TrashIcon size={14} />
                            </button>
                          </div>
                        </div>

                        {/* Doctor Advice or Clinical Notes (if present) */}
                        {item.notes && (
                          <div className="mt-2.5 p-3 rounded-xl bg-surface-sunken/70 border border-line/60 text-xs text-content-muted leading-relaxed flex items-start gap-2">
                            <FileText size={13} className="text-accent shrink-0 mt-0.5" />
                            <div>
                              <span className="font-bold text-content block text-[11px] uppercase tracking-wide">
                                Clinical Notes & Advice:
                              </span>
                              <span>{item.notes}</span>
                            </div>
                          </div>
                        )}

                        {/* Footer Action Links */}
                        {item.linkUrl && (
                          <div className="pt-2 flex items-center justify-end">
                            <Link
                              to={item.linkUrl}
                              className="inline-flex items-center gap-1 text-xs font-bold text-accent hover:underline tap-spring"
                            >
                              <span>View Associated Record</span>
                              <ArrowRight size={13} />
                            </Link>
                          </div>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

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
