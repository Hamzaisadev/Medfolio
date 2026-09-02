import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'motion/react';
import { AppShell } from '../../components/layout/AppShell';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Toast } from '../../components/ui/Toast';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import {
  Calendar,
  CalendarPlus,
  Stethoscope,
  FlaskConical,
  Pill,
  AlertCircle,
  Search,
  X,
  ShieldCheck,
  ArrowRight,
  ArrowUpDown,
  Plus,
  Tag,
  MoreHorizontal,
  FileText,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { visitsRepo, reportsRepo, medicinesRepo, sideEffectsRepo } from '../../lib/db';
import { todayInAppTz, formatMonthYear, fromAppDate } from '../../lib/time';
import { useAuth } from '../../lib/auth/AuthContext';
import type { Tables } from '../../lib/supabase/types';

type TimelineEventType = 'visit' | 'report' | 'medicine' | 'side_effect';
type TimelineFilterType = 'all' | TimelineEventType;
type SortOrder = 'newest' | 'oldest';

interface TimelineItem {
  id: string;
  type: TimelineEventType;
  date: string;
  timeDisplay?: string;
  title: string;
  subtitle: string;
  tags: string[];
  notes?: string | null;
  cost?: number | null;
  linkUrl: string;
  linkLabel: string;
  raw: Tables<'visits'> | Tables<'reports'> | Tables<'medicines'> | Tables<'side_effects'> | Tables<'medicines'>[];
  medicinesList?: Tables<'medicines'>[];
  doctorName?: string | null;
  clinicName?: string | null;
}

function formatFullDateHeader(dateStr: string): string {
  try {
    const d = fromAppDate(dateStr);
    return new Intl.DateTimeFormat('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(d);
  } catch {
    return dateStr;
  }
}

function formatMonthShortUpper(dateStr: string): string {
  try {
    const d = fromAppDate(dateStr);
    return new Intl.DateTimeFormat('en-GB', {
      month: 'short',
      timeZone: 'UTC',
    }).format(d).toUpperCase();
  } catch {
    return '';
  }
}

function formatDayNumber(dateStr: string): string {
  try {
    const d = fromAppDate(dateStr);
    return String(d.getUTCDate());
  } catch {
    return '';
  }
}

export function TimelinePage() {
  const { user, profile } = useAuth();
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterType, setFilterType] = useState<TimelineFilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');
  const [deleteTarget, setDeleteTarget] = useState<TimelineItem | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [expandedCardIds, setExpandedCardIds] = useState<Set<string>>(new Set());

  const effectiveUserId = user?.id || profile?.user_id || '';
  const effectiveProfileId = profile?.id || effectiveUserId;

  const togglePrescriptionExpanded = (id: string) => {
    setExpandedCardIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const loadData = useCallback(async () => {
    if (!effectiveProfileId) return;
    setIsLoading(true);
    try {
      const [visits, reports, medicines, sideEffects] = await Promise.all([
        visitsRepo.listVisits(effectiveProfileId),
        reportsRepo.listReports(effectiveProfileId),
        medicinesRepo.listMedicines(effectiveProfileId),
        sideEffectsRepo.listSideEffects(effectiveProfileId),
      ]);

      const timelineList: TimelineItem[] = [];

      // Add Visits (Consultations)
      for (const v of visits) {
        timelineList.push({
          id: `visit-${v.id}`,
          type: 'visit',
          date: v.visit_date,
          timeDisplay: '09:40 AM',
          title: v.diagnosis ? `${v.diagnosis} Consultation` : 'General Physician Consultation',
          subtitle: `${v.doctor_name ? `Dr. ${v.doctor_name.replace(/^dr\.?\s*/i, '')}` : 'Attending Physician'}${v.clinic_name ? ` • ${v.clinic_name}` : ' • OPD Visit'}`,
          tags: v.diagnosis ? [v.diagnosis] : ['Consultation'],
          notes: v.doctor_advice || v.notes,
          cost: v.visit_cost,
          linkUrl: `/visits/${v.id}`,
          linkLabel: 'View Visit Details',
          raw: v,
        });
      }

      // Add Diagnostic Reports
      for (const r of reports) {
        timelineList.push({
          id: `report-${r.id}`,
          type: 'report',
          date: r.report_date,
          timeDisplay: '11:15 AM',
          title: r.title,
          subtitle: r.lab_name ? `${r.lab_name} • Diagnostic Report` : 'Diagnostic Laboratory Report',
          tags: ['Lab Report'],
          notes: null,
          cost: null,
          linkUrl: `/reports`,
          linkLabel: 'View Report',
          raw: r,
        });
      }

      // Group Medicines into Unified Prescriptions / Medication Regimens
      // Prevents bloating the timeline with 10-15 cards for a single prescription event
      const medGroups = new Map<string, Tables<'medicines'>[]>();

      for (const m of medicines) {
        const key = m.visit_id ? `visit-${m.visit_id}` : `date-${m.start_date}`;
        const existing = medGroups.get(key) || [];
        existing.push(m);
        medGroups.set(key, existing);
      }

      for (const [key, medList] of medGroups.entries()) {
        const firstMed = medList[0];
        if (!firstMed) continue;

        const relatedVisit = firstMed.visit_id
          ? visits.find((v) => v.id === firstMed.visit_id)
          : null;
        const eventDate = relatedVisit?.visit_date || firstMed.start_date || todayInAppTz();
        const doctorName = relatedVisit?.doctor_name
          ? `Dr. ${relatedVisit.doctor_name.replace(/^dr\.?\s*/i, '')}`
          : null;
        const clinicName = relatedVisit?.clinic_name || null;

        const medCount = medList.length;
        const medNamesList = medList.map((m) => `${m.medicine_name}${m.strength ? ` ${m.strength}` : ''}`);
        const previewSummary =
          medNamesList.slice(0, 3).join(', ') + (medCount > 3 ? ` + ${medCount - 3} more` : '');

        const ongoingCount = medList.filter((m) => m.is_ongoing).length;
        const courseCount = medList.filter((m) => !m.is_ongoing && m.duration_days).length;

        const tags: string[] = [
          `${medCount} ${medCount === 1 ? 'medicine' : 'medicines'}`,
        ];
        if (ongoingCount > 0) tags.push(`${ongoingCount} ongoing`);
        if (courseCount > 0) tags.push(`${courseCount} short course`);

        const notesText =
          relatedVisit?.doctor_advice ||
          medList.map((m) => m.instructions).filter(Boolean).slice(0, 2).join(' • ') ||
          null;

        timelineList.push({
          id: `prescription-${key}`,
          type: 'medicine',
          date: eventDate,
          timeDisplay: '10:30 AM',
          title:
            medCount === 1
              ? `${firstMed.medicine_name} ${firstMed.strength || ''}`
              : `Prescription • ${medCount} Medications`,
          subtitle: doctorName
            ? `Prescribed by ${doctorName}${clinicName ? ` (${clinicName})` : ''} • ${previewSummary}`
            : `Medication Regimen • ${previewSummary}`,
          tags,
          notes: notesText,
          cost: null,
          linkUrl: relatedVisit ? `/visits/${relatedVisit.id}` : `/medicines/cabinet`,
          linkLabel: relatedVisit ? 'View Consultation' : 'View in Cabinet',
          raw: medList.length === 1 ? firstMed : medList,
          medicinesList: medList,
          doctorName,
          clinicName,
        });
      }

      // Add Side Effects / Symptoms
      for (const s of sideEffects) {
        const effDate = s.occurred_at ? s.occurred_at.split('T')[0] : s.created_at.split('T')[0];
        timelineList.push({
          id: `side-${s.id}`,
          type: 'side_effect',
          date: effDate || todayInAppTz(),
          timeDisplay: '03:20 PM',
          title: 'Symptom Entry',
          subtitle: s.severity ? `Severity: ${s.severity}` : 'Patient log',
          tags: [s.severity ? `${s.severity} severity` : 'Mild'],
          notes: s.note,
          cost: null,
          linkUrl: `/symptoms`,
          linkLabel: 'View Symptoms',
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
  }, [effectiveProfileId]);

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

  // Filter & Search & Sort
  const filteredItems = useMemo(() => {
    const list = items.filter((item) => {
      if (filterType !== 'all' && item.type !== filterType) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = item.title.toLowerCase().includes(q);
        const matchesSub = item.subtitle.toLowerCase().includes(q);
        const matchesNotes = item.notes ? item.notes.toLowerCase().includes(q) : false;
        const matchesTags = item.tags.some((t) => t.toLowerCase().includes(q));
        const matchesMeds = item.medicinesList
          ? item.medicinesList.some(
              (m) =>
                m.medicine_name.toLowerCase().includes(q) ||
                (m.strength && m.strength.toLowerCase().includes(q)) ||
                (m.instructions && m.instructions.toLowerCase().includes(q))
            )
          : false;
        return matchesTitle || matchesSub || matchesNotes || matchesTags || matchesMeds;
      }
      return true;
    });

    return list.sort((a, b) => {
      if (sortOrder === 'newest') {
        return b.date.localeCompare(a.date);
      }
      return a.date.localeCompare(b.date);
    });
  }, [items, filterType, searchQuery, sortOrder]);

  // Group by Month & Year
  const groupedTimeline = useMemo(() => {
    const groups: Record<string, TimelineItem[]> = {};

    for (const item of filteredItems) {
      const monthYear = formatMonthYear(item.date) || 'Other Records';
      if (!groups[monthYear]) {
        groups[monthYear] = [];
      }
      groups[monthYear].push(item);
    }

    return Object.entries(groups);
  }, [filteredItems]);

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
        if (Array.isArray(deleteTarget.raw)) {
          await Promise.all(
            (deleteTarget.raw as Tables<'medicines'>[]).map((m) =>
              medicinesRepo.deleteMedicine(m.id)
            )
          );
        } else {
          const m = deleteTarget.raw as Tables<'medicines'>;
          await medicinesRepo.deleteMedicine(m.id);
        }
      } else if (deleteTarget.type === 'side_effect') {
        const s = deleteTarget.raw as Tables<'side_effects'>;
        await sideEffectsRepo.deleteSideEffect(s.id);
      }

      setToastMessage('Record removed successfully.');
      setDeleteTarget(null);
      await loadData();
    } catch (err: unknown) {
      console.error('Delete error:', err);
      setToastMessage('Failed to delete record.');
    }
  };

  const getEventMeta = (type: TimelineEventType) => {
    switch (type) {
      case 'visit':
        return {
          label: 'Doctor Visit',
          tagClass: 'bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/20',
          nodeClass: 'text-amber-600 border-2 border-amber-400 bg-surface-raised shadow-xs',
          icon: <Stethoscope size={16} className="text-amber-600 stroke-[2.2]" />,
        };
      case 'report':
        return {
          label: 'Lab Report',
          tagClass: 'bg-blue-500/10 text-blue-800 dark:text-blue-300 border-blue-500/20',
          nodeClass: 'text-blue-600 border-2 border-blue-400 bg-surface-raised shadow-xs',
          icon: <FlaskConical size={16} className="text-blue-600 stroke-[2.2]" />,
        };
      case 'medicine':
        return {
          label: 'Prescription',
          tagClass: 'bg-teal-500/10 text-teal-800 dark:text-teal-300 border-teal-500/20',
          nodeClass: 'text-teal-600 border-2 border-teal-400 bg-surface-raised shadow-xs',
          icon: <Pill size={16} className="text-teal-600 stroke-[2.2]" />,
        };
      case 'side_effect':
        return {
          label: 'Symptom',
          tagClass: 'bg-rose-500/10 text-rose-800 dark:text-rose-300 border-rose-500/20',
          nodeClass: 'text-rose-600 border-2 border-rose-400 bg-surface-raised shadow-xs',
          icon: <AlertCircle size={16} className="text-rose-600 stroke-[2.2]" />,
        };
    }
  };

  return (
    <AppShell>
      {toastMessage && (
        <Toast
          open
          onClose={() => setToastMessage(null)}
          message={toastMessage}
          tone="ok"
        />
      )}

      {/* Executive Master Header Deck (Compact KPI alignment) */}
      <div className="p-3.5 sm:p-4 px-4 sm:px-6 pr-6 sm:pr-8 rounded-3xl bg-[#023b36] border border-[#0a544e]/70 shadow-[0_12px_32px_-8px_rgba(1,53,49,0.6)] mb-6 overflow-hidden relative z-30">
        <div className="flex items-center justify-between gap-3 sm:gap-4 w-full">
          {/* Left: App Icon + Title + Subtitle */}
          <div className="flex items-center gap-3 sm:gap-3.5 shrink-0 min-w-0">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-[#00b59f] text-white flex items-center justify-center shrink-0 shadow-md">
              <CalendarPlus size={20} className="text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-bold text-white tracking-tight leading-tight whitespace-nowrap">
                Medical Timeline
              </h1>
              <p className="text-xs text-[#a0d7d2] font-normal hidden md:block whitespace-nowrap mt-0.5">
                Longitudinal record of consultations, diagnostic labs, prescriptions & symptoms.
              </p>
            </div>
          </div>

          {/* Right Group: Action Controls + Divider + KPI Stats */}
          <div className="flex items-center gap-3 sm:gap-4 shrink-0 pr-1">
            {/* Quick Action Buttons */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <Link
                to="/doctors"
                title="View Doctors Directory"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#012f2c] hover:bg-[#012522] border border-[#09524c] text-[#78c2ba] hover:text-white text-xs font-semibold tap-spring transition-all shadow-inner shrink-0"
              >
                <Stethoscope size={13} className="text-[#00e5c9]" />
                <span>Doctors</span>
              </Link>

              <Link
                to="/prescriptions/new"
                title="Add Visit or Prescription"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#012f2c] hover:bg-[#012522] border border-[#09524c] text-[#78c2ba] hover:text-white text-xs font-semibold tap-spring transition-all shadow-inner shrink-0"
              >
                <Plus size={13} className="text-[#00e5c9]" />
                <span>Add Visit</span>
              </Link>
            </div>

            {/* Vertical Divider */}
            <div className="h-7 w-[1px] bg-teal-500/25 hidden md:block shrink-0 mx-0.5" />

            {/* KPI Stats */}
            <div className="flex items-center gap-3 sm:gap-3.5 shrink-0">
              <div className="flex flex-col items-center min-w-[26px] sm:min-w-[30px]">
                <span className="text-[10px] sm:text-[11px] font-medium text-[#78c2ba] leading-tight">Visits</span>
                <span className="text-sm sm:text-base font-bold text-white leading-none mt-1" data-numeric>
                  {counts.visit}
                </span>
              </div>

              <div className="flex flex-col items-center min-w-[26px] sm:min-w-[30px]">
                <span className="text-[10px] sm:text-[11px] font-medium text-[#78c2ba] leading-tight">Labs</span>
                <span className="text-sm sm:text-base font-bold text-white leading-none mt-1" data-numeric>
                  {counts.report}
                </span>
              </div>

              <div className="flex flex-col items-center min-w-[26px] sm:min-w-[30px]">
                <span className="text-[10px] sm:text-[11px] font-medium text-[#78c2ba] leading-tight">Rx</span>
                <span className="text-sm sm:text-base font-bold text-white leading-none mt-1" data-numeric>
                  {counts.medicine}
                </span>
              </div>

              <div className="flex flex-col items-center min-w-[26px] sm:min-w-[30px]">
                <span className="text-[10px] sm:text-[11px] font-medium text-[#78c2ba] leading-tight">Total</span>
                <span className="text-sm sm:text-base font-black text-[#00e5c9] leading-none mt-1" data-numeric>
                  {counts.all}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Routine Filter Toolbar */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 sm:gap-4 mb-8">
        {/* Segmented Category Filter */}
        <div className="w-full lg:w-auto overflow-x-auto scrollbar-none">
          <SegmentedControl<TimelineFilterType>
            value={filterType}
            onChange={setFilterType}
            size="sm"
            options={[
              { value: 'all', label: `All (${counts.all})` },
              { value: 'visit', label: `Visits (${counts.visit})` },
              { value: 'report', label: `Labs (${counts.report})` },
              { value: 'medicine', label: `Prescriptions (${counts.medicine})` },
              { value: 'side_effect', label: `Symptoms (${counts.side_effect})` },
            ]}
          />
        </div>

        {/* Search Bar + Sort Order + Verified Badge */}
        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap justify-between lg:justify-end">
          {/* Search Box */}
          <div className="relative flex-1 sm:w-64 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-content-subtle pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search timeline records..."
              className="w-full pl-9 pr-7 h-9 text-xs rounded-xl bg-surface-sunken border border-line text-content placeholder:text-content-subtle focus:border-accent focus:outline-none transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-content-subtle hover:text-content rounded cursor-pointer"
                aria-label="Clear search"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Chronological Sort Toggle */}
          <button
            type="button"
            onClick={() => setSortOrder((prev) => (prev === 'newest' ? 'oldest' : 'newest'))}
            className="h-9 px-3 rounded-xl border border-line bg-surface-sunken hover:bg-surface-hover text-xs font-semibold text-content-muted hover:text-content flex items-center gap-1.5 tap-spring transition-colors cursor-pointer shrink-0"
            title={sortOrder === 'newest' ? 'Switch to Oldest First' : 'Switch to Newest First'}
          >
            <ArrowUpDown size={13} className="text-teal-600 dark:text-teal-400" />
            <span>{sortOrder === 'newest' ? 'Newest' : 'Oldest'}</span>
          </button>

          {/* Verified Timeline Badge */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-sunken border border-line text-xs font-semibold text-content-subtle shrink-0">
            <ShieldCheck size={14} className="text-teal-600 dark:text-teal-400" />
            <span>Verified Timeline</span>
          </div>
        </div>
      </div>

      {/* Main Longitudinal Timeline Stream */}
      <main className="space-y-10">
        {isLoading ? (
          /* Timeline Skeleton Loading Stream */
          <div className="space-y-6">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-start gap-3 sm:gap-4">
                <div className="w-12 sm:w-14 pt-0.5 flex flex-col items-center gap-1.5 shrink-0">
                  <Skeleton className="h-3 w-8 rounded" />
                  <Skeleton className="h-8 w-8 sm:h-9 sm:w-9 rounded-full" />
                  <Skeleton className="w-[2.5px] h-24 rounded-full" />
                </div>
                <Skeleton className="h-36 flex-1 rounded-2xl" />
              </div>
            ))}
          </div>
        ) : filteredItems.length === 0 ? (
          /* Empty State */
          <EmptyState
            heading={searchQuery || filterType !== 'all' ? 'No matching records found' : 'No medical history recorded yet'}
            description={
              searchQuery || filterType !== 'all'
                ? 'Try adjusting your search keywords or clearing active category filters.'
                : 'Add your first prescription, doctor consultation, or diagnostic report to automatically construct your longitudinal medical timeline.'
            }
            action={
              searchQuery || filterType !== 'all' ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setSearchQuery('');
                    setFilterType('all');
                  }}
                  className="tap-spring"
                >
                  Show all records ({items.length})
                </Button>
              ) : (
                <Link to="/prescriptions/new">
                  <Button leftIcon={<Plus size={16} />} size="sm" className="tap-spring">
                    Add first prescription
                  </Button>
                </Link>
              )
            }
          />
        ) : (
          /* Vertical Timeline with Date Node & Connecting Spine */
          <div className="space-y-10">
            {groupedTimeline.map(([monthGroup, groupItems]) => (
              <section key={monthGroup} aria-labelledby={`month-${monthGroup}`} className="space-y-6">
                {/* Month Milestone Header */}
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-700 dark:text-teal-400 shrink-0 shadow-2xs">
                    <Calendar size={18} />
                  </div>
                  <div className="flex items-center gap-2.5">
                    <h2
                      id={`month-${monthGroup}`}
                      className="text-sm font-black uppercase tracking-wider text-content"
                    >
                      {monthGroup}
                    </h2>
                    <span className="text-[11px] font-semibold text-content-subtle px-2.5 py-0.5 rounded-full bg-surface-sunken border border-line">
                      {groupItems.length} {groupItems.length === 1 ? 'event' : 'events'}
                    </span>
                  </div>
                </div>

                {/* Event Items */}
                <div className="relative space-y-0">
                  {groupItems.map((item, itemIdx) => {
                    const meta = getEventMeta(item.type);
                    const dayNum = formatDayNumber(item.date);
                    const monthShort = formatMonthShortUpper(item.date);
                    const fullDateHeader = formatFullDateHeader(item.date);
                    const isLast = itemIdx === groupItems.length - 1;

                    const hasMedsList = Boolean(item.medicinesList && item.medicinesList.length > 0);
                    const isExpanded =
                      expandedCardIds.has(item.id) ||
                      (Boolean(searchQuery.trim()) &&
                        item.medicinesList?.some((m) =>
                          m.medicine_name.toLowerCase().includes(searchQuery.toLowerCase())
                        ));

                    return (
                      <div key={item.id} className="relative flex items-start gap-3 sm:gap-4 group">
                        {/* Column 1: Date Spine Node */}
                        <div className="flex flex-col items-center shrink-0 w-12 sm:w-14 self-stretch pt-0.5 relative select-none">
                          {/* Month Short Label (e.g. APR) */}
                          <span className="text-[11px] sm:text-xs font-bold text-teal-600 dark:text-teal-400 tracking-wider uppercase leading-none mb-1.5 text-center">
                            {monthShort}
                          </span>

                          {/* Day Badge & Horizontal Connector */}
                          <div className="relative flex items-center justify-center">
                            {/* Solid Teal/Green Circle Day Badge */}
                            <div
                              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-teal-600 dark:bg-teal-500 text-white font-bold text-xs sm:text-sm flex items-center justify-center shadow-xs z-10 shrink-0 group-hover:scale-105 transition-transform"
                              data-numeric
                            >
                              {dayNum}
                            </div>

                            {/* Horizontal Connector Line towards card */}
                            <div
                              className="absolute left-full w-3 sm:w-4 h-[2px] bg-teal-500/80 dark:bg-teal-400/80"
                              aria-hidden="true"
                            />
                          </div>

                          {/* Vertical Spine Line extending downwards */}
                          {!isLast && (
                            <div
                              className="w-[2.5px] bg-teal-500/50 dark:bg-teal-400/40 rounded-full flex-1 my-1 min-h-[32px]"
                              aria-hidden="true"
                            />
                          )}
                        </div>

                        {/* Column 2: Event Card */}
                        <div className="flex-1 min-w-0 pb-6">
                          <motion.article
                            layout
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            whileHover={{ y: -1 }}
                            transition={{ type: 'spring', stiffness: 450, damping: 30 }}
                            className="w-full rounded-2xl border border-line bg-surface-raised p-4 sm:p-5 shadow-2xs hover:shadow-card transition-all relative"
                          >
                            {/* Top Row: Event Category Pill + Full Formatted Date + Action Menu */}
                            <div className="flex items-center justify-between gap-2">
                              {/* Category Pill with Icon */}
                              <span
                                className={clsx(
                                  'inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-bold border',
                                  meta.tagClass
                                )}
                              >
                                {meta.icon}
                                <span>{meta.label}</span>
                              </span>

                              <div className="flex items-center gap-3">
                                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-content-subtle">
                                  <Calendar size={13} className="text-content-subtle shrink-0" />
                                  <span>{fullDateHeader}</span>
                                  {item.timeDisplay && <span data-numeric>• {item.timeDisplay}</span>}
                                </span>

                                <button
                                  type="button"
                                  onClick={() => setDeleteTarget(item)}
                                  className="w-7 h-7 rounded-lg flex items-center justify-center text-content-subtle hover:text-rose-600 hover:bg-rose-500/10 transition-colors cursor-pointer"
                                  title="Delete record"
                                  aria-label={`Delete ${item.title}`}
                                >
                                  <MoreHorizontal size={16} />
                                </button>
                              </div>
                            </div>

                            {/* Middle Content: Title & Subtitle */}
                            <div className="mt-3 space-y-1">
                              <h3
                                className="text-base sm:text-lg font-bold text-content leading-snug tracking-tight"
                                title={item.title}
                              >
                                <Link to={item.linkUrl} className="hover:text-teal-700 dark:hover:text-teal-400 hover:underline">
                                  {item.title}
                                </Link>
                              </h3>

                              <p className="text-xs sm:text-sm text-content-muted font-normal">
                                {item.subtitle}
                              </p>
                            </div>

                            {/* Tags & Metadata Badges */}
                            {(item.tags.length > 0 || item.cost) && (
                              <div className="mt-3 flex items-center gap-2 flex-wrap">
                                {item.tags.map((tag, idx) => (
                                  <span
                                    key={idx}
                                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-sunken border border-line text-xs text-content font-medium"
                                  >
                                    <Tag size={11} className="text-content-subtle" />
                                    <span>{tag}</span>
                                  </span>
                                ))}

                                {item.cost && (
                                  <span className="inline-flex items-center px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/20 text-xs font-bold text-teal-800 dark:text-teal-300" data-numeric>
                                    PKR {item.cost.toLocaleString()}
                                  </span>
                                )}
                              </div>
                            )}

                            {/* Doctor Notes / Advice Box (if present) */}
                            {item.notes && (
                              <div className="mt-3 text-xs text-content bg-surface-sunken/60 border border-line/60 rounded-xl p-3 flex items-start gap-2 leading-relaxed">
                                <FileText size={14} className="text-teal-700 dark:text-teal-400 shrink-0 mt-0.5" />
                                <span className="line-clamp-2">{item.notes}</span>
                              </div>
                            )}

                            {/* Expandable Grouped Prescription List (Consolidated View) */}
                            {hasMedsList && item.medicinesList && (
                              <div className="mt-3.5 pt-3 border-t border-line/70 space-y-2">
                                <button
                                  type="button"
                                  onClick={() => togglePrescriptionExpanded(item.id)}
                                  className="w-full flex items-center justify-between text-xs font-bold text-teal-800 dark:text-teal-300 hover:text-teal-900 px-2 py-1.5 rounded-lg bg-teal-500/5 hover:bg-teal-500/10 transition-colors cursor-pointer"
                                >
                                  <span className="flex items-center gap-1.5">
                                    <Pill size={14} className="text-teal-600 dark:text-teal-400" />
                                    <span>
                                      {isExpanded
                                        ? `Hide medications list (${item.medicinesList.length})`
                                        : `Show all ${item.medicinesList.length} prescribed medications`}
                                    </span>
                                  </span>
                                  {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                                </button>

                                <AnimatePresence initial={false}>
                                  {isExpanded && (
                                    <motion.div
                                      initial={{ opacity: 0, height: 0 }}
                                      animate={{ opacity: 1, height: 'auto' }}
                                      exit={{ opacity: 0, height: 0 }}
                                      transition={{ duration: 0.2 }}
                                      className="overflow-hidden"
                                    >
                                      <div className="divide-y divide-line/60 rounded-xl border border-line bg-surface-sunken/50 overflow-hidden mt-2">
                                        {item.medicinesList.map((med) => (
                                          <div
                                            key={med.id}
                                            className="p-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 hover:bg-surface-hover/50 transition-colors"
                                          >
                                            <div className="min-w-0 space-y-0.5">
                                              <div className="flex items-center gap-1.5 flex-wrap">
                                                <span className="font-bold text-content text-xs sm:text-sm">
                                                  {med.medicine_name}
                                                </span>
                                                {med.strength && (
                                                  <span className="text-content-muted font-normal text-xs">
                                                    ({med.strength})
                                                  </span>
                                                )}
                                                {med.form && (
                                                  <span className="text-2xs uppercase tracking-wider px-1.5 py-0.5 rounded bg-surface-raised border border-line text-content-subtle font-medium">
                                                    {med.form}
                                                  </span>
                                                )}
                                              </div>
                                              <div className="flex items-center gap-2 text-[11px] text-content-muted flex-wrap">
                                                <span>
                                                  Dose: <strong className="text-content">{med.dose_amount || '1'}</strong>
                                                </span>
                                                <span>•</span>
                                                <span className="text-teal-700 dark:text-teal-400 font-semibold">
                                                  {med.frequency_code || med.frequency_raw || 'Standard'}
                                                </span>
                                                <span>•</span>
                                                <span>{med.with_food ? 'With food' : 'Empty stomach'}</span>
                                                {med.instructions && (
                                                  <>
                                                    <span>•</span>
                                                    <span className="italic text-content-subtle truncate max-w-xs">
                                                      {med.instructions}
                                                    </span>
                                                  </>
                                                )}
                                              </div>
                                            </div>

                                            <div className="flex items-center gap-2 shrink-0 sm:self-center">
                                              {med.is_ongoing ? (
                                                <Badge tone="info" size="sm">Ongoing</Badge>
                                              ) : med.duration_days ? (
                                                <Badge tone="neutral" size="sm">{med.duration_days} days</Badge>
                                              ) : null}
                                              <Link
                                                to={`/medicines/${med.id}`}
                                                className="text-2xs font-semibold text-teal-700 dark:text-teal-400 hover:underline px-2.5 py-1 rounded-md bg-surface-raised border border-line"
                                              >
                                                Details
                                              </Link>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            )}

                            {/* Bottom Action Link */}
                            <div className="mt-4 pt-3 border-t border-line/60 flex items-center justify-end">
                              <Link
                                to={item.linkUrl}
                                className="inline-flex items-center gap-1 text-xs font-bold text-teal-700 dark:text-teal-400 hover:underline tap-spring"
                              >
                                <span>{item.linkLabel}</span>
                                <ArrowRight size={13} />
                              </Link>
                            </div>
                          </motion.article>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>

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
