import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
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
  MedicineIcon,
  LabFlaskIcon,
  StethoscopeIcon,
  AlertTriangleIcon,
  PrinterIcon,
  CalendarIcon,
  SearchIcon,
  XIcon,
  ChevronDownIcon,
  PlusIcon,
} from '../../components/ui/icons';
import { visitsRepo, reportsRepo, medicinesRepo, sideEffectsRepo } from '../../lib/db';
import { todayInAppTz } from '../../lib/time';
import { staggerContainer, staggerItem } from '../../lib/motion';
import type { Tables } from '../../lib/supabase/types';
import { useAuth } from '../../lib/auth/AuthContext';

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
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});

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

      for (const v of visits) {
        timelineList.push({
          id: `visit-${v.id}`,
          type: 'visit',
          date: v.visit_date,
          title: v.doctor_name ? `Doctor Consultation — ${v.doctor_name}` : 'Doctor Consultation',
          subtitle: v.clinic_name || 'Clinic / Hospital',
          tags: v.diagnosis ? [v.diagnosis] : [],
          notes: v.doctor_advice || v.notes,
          cost: v.visit_cost,
          raw: v,
        });
      }

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
          raw: r,
        });
      }

      for (const m of medicines) {
        timelineList.push({
          id: `med-${m.id}`,
          type: 'medicine',
          date: m.start_date || todayInAppTz(),
          title: `Prescription: ${m.medicine_name}`,
          subtitle: [m.strength, m.form].filter(Boolean).join(' · ') || 'Medication Course',
          tags: [m.frequency_code || 'Prescribed'],
          notes: m.instructions,
          cost: null,
          raw: m,
        });
      }

      for (const s of sideEffects) {
        timelineList.push({
          id: `se-${s.id}`,
          type: 'side_effect',
          date: s.occurred_at.split('T')[0] || todayInAppTz(),
          title: `Symptom Log: ${s.medicine_name}`,
          subtitle: `Reported Reaction (${s.severity || 'Mild'})`,
          tags: s.severity ? [s.severity] : ['Symptom'],
          notes: s.note,
          cost: null,
          raw: s,
        });
      }

      timelineList.sort((a, b) => b.date.localeCompare(a.date));
      setItems(timelineList);
    } catch (err) {
      console.error('Failed to load timeline:', err);
    } finally {
      setIsLoading(false);
    }
  }, [effectiveProfileId, effectiveUserId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const toggleNoteExpand = (id: string) => {
    setExpandedNotes((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const counts = useMemo(() => {
    return {
      all: items.length,
      visits: items.filter((i) => i.type === 'visit').length,
      reports: items.filter((i) => i.type === 'report').length,
      medicines: items.filter((i) => i.type === 'medicine').length,
      side_effects: items.filter((i) => i.type === 'side_effect').length,
    };
  }, [items]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (filterType !== 'all' && item.type !== filterType) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        item.title.toLowerCase().includes(q) ||
        item.subtitle.toLowerCase().includes(q) ||
        (item.notes && item.notes.toLowerCase().includes(q)) ||
        item.tags.some((t) => t.toLowerCase().includes(q)) ||
        item.date.toLowerCase().includes(q)
      );
    });
  }, [items, filterType, searchQuery]);

  const groupedTimeline = useMemo(() => {
    const groups: { [month: string]: TimelineItem[] } = {};
    for (const item of filteredItems) {
      const d = new Date(item.date);
      const monthKey = isNaN(d.getTime())
        ? 'Other Records'
        : d.toLocaleString('default', { month: 'long', year: 'numeric' });
      if (!groups[monthKey]) groups[monthKey] = [];
      groups[monthKey]?.push(item);
    }
    return Object.entries(groups);
  }, [filteredItems]);

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      if (deleteTarget.type === 'visit') {
        await visitsRepo.deleteVisit((deleteTarget.raw as Tables<'visits'>).id);
      } else if (deleteTarget.type === 'report') {
        await reportsRepo.deleteReport((deleteTarget.raw as Tables<'reports'>).id);
      } else if (deleteTarget.type === 'medicine') {
        await medicinesRepo.deleteMedicine((deleteTarget.raw as Tables<'medicines'>).id);
      } else if (deleteTarget.type === 'side_effect') {
        await sideEffectsRepo.deleteSideEffect((deleteTarget.raw as Tables<'side_effects'>).id);
      }
      setToastMessage('Record deleted successfully.');
      setDeleteTarget(null);
      await loadData();
    } catch (err: unknown) {
      console.error('Delete error:', err);
      setToastMessage('Failed to delete record.');
    }
  };

  const getNodeMeta = (type: TimelineEventType) => {
    switch (type) {
      case 'visit':
        return {
          icon: <StethoscopeIcon size={16} className="text-ok-text" />,
          bg: 'bg-ok-bg border-ok-border text-ok-text',
          badge: <Badge tone="ok" size="sm">Doctor Visit</Badge>,
          accentBar: 'bg-ok-text',
        };
      case 'report':
        return {
          icon: <LabFlaskIcon size={16} className="text-info-text" />,
          bg: 'bg-info-bg border-info-border text-info-text',
          badge: <Badge tone="info" size="sm">Lab Report</Badge>,
          accentBar: 'bg-info-text',
        };
      case 'medicine':
        return {
          icon: <MedicineIcon size={16} className="text-accent" />,
          bg: 'bg-accent-subtle border-accent/30 text-accent',
          badge: <Badge tone="neutral" size="sm">Prescription</Badge>,
          accentBar: 'bg-accent',
        };
      case 'side_effect':
        return {
          icon: <AlertTriangleIcon size={16} className="text-warn-text" />,
          bg: 'bg-warn-bg border-warn-border text-warn-text',
          badge: <Badge tone="warn" size="sm">Symptom Note</Badge>,
          accentBar: 'bg-warn-text',
        };
    }
  };

  return (
    <AppShell>
      <PageHeader
        title="Medical Timeline"
        description="Unified chronological log of doctor consultations, prescriptions, diagnostic lab reports, and symptom notes."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Link to="/doctor">
              <Button variant="secondary" size="sm" className="font-bold" leftIcon={<PrinterIcon size={16} />}>
                Clinical Dossier
              </Button>
            </Link>
            <Link to="/prescriptions/new">
              <Button leftIcon={<PlusIcon size={16} />} size="sm">
                Add Record
              </Button>
            </Link>
          </div>
        }
      />

      <Toast
        open={Boolean(toastMessage)}
        message={toastMessage || ''}
        tone="ok"
        onClose={() => setToastMessage(null)}
      />

      {/* Clinical Metrics Summary Bar */}
      {!isLoading && items.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6"
        >
          <div className="p-3.5 rounded-2xl bg-surface-raised border border-line shadow-card flex items-center gap-3">
            <span className="shrink-0 w-9 h-9 rounded-xl bg-ok-bg text-ok-text border border-ok-border flex items-center justify-center">
              <StethoscopeIcon size={18} />
            </span>
            <div>
              <span className="block text-lg font-black text-content" data-numeric>
                {counts.visits}
              </span>
              <span className="block text-2xs text-content-muted font-medium">Doctor Visits</span>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-surface-raised border border-line shadow-card flex items-center gap-3">
            <span className="shrink-0 w-9 h-9 rounded-xl bg-info-bg text-info-text border border-info-border flex items-center justify-center">
              <LabFlaskIcon size={18} />
            </span>
            <div>
              <span className="block text-lg font-black text-content" data-numeric>
                {counts.reports}
              </span>
              <span className="block text-2xs text-content-muted font-medium">Lab Reports</span>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-surface-raised border border-line shadow-card flex items-center gap-3">
            <span className="shrink-0 w-9 h-9 rounded-xl bg-accent-subtle text-accent border border-accent/30 flex items-center justify-center">
              <MedicineIcon size={18} />
            </span>
            <div>
              <span className="block text-lg font-black text-content" data-numeric>
                {counts.medicines}
              </span>
              <span className="block text-2xs text-content-muted font-medium">Prescriptions</span>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-surface-raised border border-line shadow-card flex items-center gap-3">
            <span className="shrink-0 w-9 h-9 rounded-xl bg-warn-bg text-warn-text border border-warn-border flex items-center justify-center">
              <AlertTriangleIcon size={18} />
            </span>
            <div>
              <span className="block text-lg font-black text-content" data-numeric>
                {counts.side_effects}
              </span>
              <span className="block text-2xs text-content-muted font-medium">Symptom Notes</span>
            </div>
          </div>
        </motion.div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3.5 mb-8 p-3 rounded-2xl bg-surface-raised border border-line shadow-card">
        {/* Filter Pills with layout animation */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none relative">
          {[
            { id: 'all', label: `All (${counts.all})` },
            { id: 'visit', label: `Visits (${counts.visits})` },
            { id: 'report', label: `Labs (${counts.reports})` },
            { id: 'medicine', label: `Medicines (${counts.medicines})` },
            { id: 'side_effect', label: `Symptoms (${counts.side_effects})` },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterType(tab.id)}
              className={`relative px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                filterType === tab.id
                  ? 'text-content-onaccent'
                  : 'bg-surface-sunken text-content-muted hover:bg-surface-hover hover:text-content border border-line'
              }`}
            >
              {filterType === tab.id && (
                <motion.div
                  layoutId="timeline-filter-pill"
                  className="absolute inset-0 rounded-xl bg-accent shadow-xs"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}
              <span className="relative z-10">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-72">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search doctors, labs, meds..."
            className="pr-8"
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-content-subtle hover:text-content p-1 cursor-pointer"
            >
              <XIcon size={14} />
            </button>
          ) : (
            <SearchIcon size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-content-subtle pointer-events-none" />
          )}
        </div>
      </div>

      {/* Connected Medical Timeline */}
      {isLoading ? (
        <div className="space-y-6 pl-6 border-l-2 border-line ml-4">
          <Skeleton className="h-6 w-36 rounded-full" />
          <Skeleton className="h-32 w-full rounded-[var(--radius-xl)]" />
          <Skeleton className="h-32 w-full rounded-[var(--radius-xl)]" />
        </div>
      ) : filteredItems.length === 0 ? (
        <EmptyState
          heading={searchQuery ? 'No matching medical history found' : 'No clinical records logged yet'}
          description={
            searchQuery
              ? 'Try modifying your search keywords or switching filter tabs.'
              : 'Add your first prescription, doctor consultation, or lab report to build your longitudinal timeline.'
          }
          action={
            <Link to="/prescriptions/new">
              <Button leftIcon={<PlusIcon size={16} />}>Scan First Prescription</Button>
            </Link>
          }
        />
      ) : (
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="space-y-10"
        >
          {groupedTimeline.map(([monthGroup, groupItems]) => (
            <motion.div key={monthGroup} variants={staggerItem} className="space-y-5">
              {/* Month Header Pill */}
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-content-muted bg-surface-raised border border-line px-3.5 py-1 rounded-full shadow-xs">
                  <CalendarIcon size={13} className="text-accent" />
                  {monthGroup}
                </span>
                <div className="h-px bg-line flex-1" />
              </div>

              {/* Vertical Tree Spine & Event Nodes */}
              <div className="relative pl-6 sm:pl-8 space-y-4 before:absolute before:left-3 sm:before:left-4 before:top-3 before:bottom-3 before:w-0.5 before:bg-line">
                {groupItems.map((item) => {
                  const nodeMeta = getNodeMeta(item.type);
                  const isExpanded = Boolean(expandedNotes[item.id]);

                  return (
                    <motion.div
                      key={item.id}
                      layout
                      whileHover={{ y: -2 }}
                      transition={{ type: 'spring', stiffness: 450, damping: 30 }}
                      className="relative"
                    >
                      {/* Node Bead Anchor on Timeline Spine */}
                      <span
                        className={`absolute -left-6 sm:-left-8 top-5 w-6.5 h-6.5 rounded-full border-2 flex items-center justify-center shadow-xs transition-transform ${nodeMeta.bg}`}
                        aria-hidden="true"
                      >
                        {nodeMeta.icon}
                      </span>

                      {/* Event Card */}
                      <Card className="p-4 sm:p-5 bg-surface-raised border border-line shadow-card hover:border-line-strong hover:shadow-raise transition-all">
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <h3 className="text-sm sm:text-base font-bold text-content tracking-tight">
                                {item.title}
                              </h3>
                              {nodeMeta.badge}
                              {item.tags.map((tag, idx) => (
                                <span
                                  key={idx}
                                  className="text-2xs px-2 py-0.5 rounded-lg bg-surface-sunken border border-line text-content-muted font-medium"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>

                            <p className="text-xs text-content-muted">
                              {item.subtitle} • <span className="font-mono text-content-subtle">{item.date}</span>
                            </p>
                          </div>

                          {/* Fee & Action Header */}
                          <div className="flex items-center gap-3 self-end sm:self-auto shrink-0">
                            {item.cost && (
                              <span className="text-xs font-bold text-content-muted bg-surface-sunken border border-line px-2.5 py-1 rounded-lg font-mono" data-numeric>
                                PKR {item.cost.toLocaleString()}
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(item)}
                              className="text-xs text-content-subtle hover:text-risk-text font-medium px-2 py-1 rounded hover:bg-risk-bg/40 transition-colors cursor-pointer"
                              title="Delete this record"
                            >
                              Delete
                            </button>
                          </div>
                        </div>

                        {/* Doctor Notes & Advice Drawer */}
                        {item.notes && (
                          <div className="mt-3.5 pt-3 border-t border-line/60">
                            <button
                              type="button"
                              onClick={() => toggleNoteExpand(item.id)}
                              className="flex items-center justify-between w-full text-xs font-semibold text-content-muted hover:text-content transition-colors cursor-pointer"
                            >
                              <span>Clinical Notes & Advice</span>
                              <ChevronDownIcon
                                size={14}
                                className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                              />
                            </button>

                            <AnimatePresence>
                              {isExpanded && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.2 }}
                                  className="overflow-hidden"
                                >
                                  <p className="mt-2 text-xs text-content-muted bg-surface-sunken/80 border border-line rounded-lg px-3 py-2.5 leading-relaxed whitespace-pre-wrap">
                                    {item.notes}
                                  </p>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        )}
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete Medical Record"
        description={`Are you sure you want to permanently delete "${deleteTarget?.title}" from ${deleteTarget?.date}? This action cannot be undone.`}
        requiredPhrase="DELETE"
        tone="danger"
        confirmLabel="Permanently Delete"
        onConfirm={handleDeleteConfirm}
      />
    </AppShell>
  );
}
