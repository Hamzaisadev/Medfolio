import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
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
} from '../../components/ui/icons';
import { visitsRepo, reportsRepo, medicinesRepo, sideEffectsRepo } from '../../lib/db';
import { todayInAppTz } from '../../lib/time';
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
  raw: Tables<'visits'> | Tables<'reports'> | Tables<'medicines'> | Tables<'side_effects'>;
}

import { useAuth } from '../../lib/auth/AuthContext';

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
        reportsRepo.listReports(effectiveUserId),
        medicinesRepo.listMedicines(effectiveUserId),
        sideEffectsRepo.listSideEffects(effectiveUserId),
      ]);

      const timelineList: TimelineItem[] = [];

      // Add Visits
      for (const v of visits) {
        timelineList.push({
          id: `visit-${v.id}`,
          type: 'visit',
          date: v.visit_date,
          title: v.doctor_name ? `Doctor Visit — ${v.doctor_name}` : 'Doctor Visit',
          subtitle: v.clinic_name || 'Clinic / Hospital',
          tags: v.diagnosis ? [v.diagnosis] : [],
          notes: v.doctor_advice || v.notes,
          cost: v.visit_cost,
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
          raw: r,
        });
      }

      // Add Medicines
      for (const m of medicines) {
        timelineList.push({
          id: `med-${m.id}`,
          type: 'medicine',
          date: m.start_date,
          title: `Medicine Started — ${m.medicine_name}`,
          subtitle: `${m.strength || ''} • ${m.frequency_code || m.frequency_raw || 'Daily'}`,
          tags: m.is_ongoing ? ['Ongoing'] : m.duration_days ? [`${m.duration_days} days`] : [],
          notes: m.instructions,
          cost: null,
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
          title: `Symptom / Side Effect Logged`,
          subtitle: s.severity ? `Severity: ${s.severity}` : 'Logged note',
          tags: [s.severity || 'mild'],
          notes: s.note,
          cost: null,
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

  // Group by Month & Year (e.g. "August 2026")
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

  const getTypeIcon = (type: TimelineEventType) => {
    switch (type) {
      case 'visit':
        return <StethoscopeIcon size={18} className="text-teal-700" />;
      case 'report':
        return <LabFlaskIcon size={18} className="text-blue-700" />;
      case 'medicine':
        return <MedicineIcon size={18} className="text-purple-700" />;
      case 'side_effect':
        return <span className="text-sm font-bold text-amber-700">⚠️</span>;
    }
  };

  const getTypeBadge = (type: TimelineEventType) => {
    switch (type) {
      case 'visit':
        return <Badge tone="ok" size="sm">Doctor Visit</Badge>;
      case 'report':
        return <Badge tone="info" size="sm">Lab Report</Badge>;
      case 'medicine':
        return <Badge tone="neutral" size="sm">Prescription</Badge>;
      case 'side_effect':
        return <Badge tone="warn" size="sm">Symptom Note</Badge>;
    }
  };

  return (
    <AppShell>
      <PageHeader
        title="Medical Timeline"
        description="Unified chronological log of doctor consultations, prescriptions, lab reports, and side effect entries."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Link to="/doctor">
              <Button variant="secondary" size="sm" className="font-bold">
                🖨️ Export Clinical Dossier PDF
              </Button>
            </Link>
            <Link to="/prescriptions/new">
              <Button leftIcon={<PrescriptionIcon size={16} />} size="sm">
                Add Visit
              </Button>
            </Link>
            <Link to="/reports/new">
              <Button variant="secondary" leftIcon={<LabFlaskIcon size={16} />} size="sm">
                Add Lab Report
              </Button>
            </Link>
          </div>
        }
      />

      <Toast
        open={Boolean(toastMessage)}
        onClose={() => setToastMessage(null)}
        message={toastMessage || ''}
        tone="ok"
      />

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 mb-6">
        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {[
            { id: 'all', label: 'All History' },
            { id: 'visit', label: 'Doctor Visits' },
            { id: 'report', label: 'Lab Reports' },
            { id: 'medicine', label: 'Medicines' },
            { id: 'side_effect', label: 'Symptoms' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterType(tab.id)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
                filterType === tab.id
                  ? 'bg-teal-800 text-white shadow-xs'
                  : 'bg-ink-100 text-ink-600 hover:bg-ink-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="w-full md:w-72">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search timeline..."
          />
        </div>
      </div>

      {/* Timeline List */}
      {isLoading ? (
        <div className="space-y-6">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      ) : filteredItems.length === 0 ? (
        <EmptyState
          heading={searchQuery ? 'No matching records found' : 'No medical history recorded yet'}
          description={
            searchQuery
              ? 'Try changing your search keywords or filter tab.'
              : 'Add your first prescription, doctor visit, or diagnostic report to start your chronological timeline.'
          }
          action={
            <Link to="/prescriptions/new">
              <Button size="sm">Add First Prescription</Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-8">
          {groupedTimeline.map(([monthGroup, groupItems]) => (
            <div key={monthGroup} className="space-y-4">
              {/* Month Group Header */}
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold uppercase tracking-wider text-ink-500 bg-ink-100 px-3 py-1 rounded-full">
                  {monthGroup}
                </span>
                <div className="h-px bg-ink-200 flex-1" />
              </div>

              {/* Items in Month */}
              <div className="space-y-3 pl-2 sm:pl-4 border-l-2 border-teal-600/30 ml-3">
                {groupItems.map((item) => (
                  <Card
                    key={item.id}
                    className="transition-all hover:border-ink-300 relative group"
                  >
                    <div className="p-4 sm:p-5">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div className="w-9 h-9 rounded-full bg-ink-50 border border-ink-200 flex items-center justify-center shrink-0 mt-0.5">
                            {getTypeIcon(item.type)}
                          </div>
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-sm font-bold text-ink-900">{item.title}</h3>
                              {getTypeBadge(item.type)}
                              {item.tags.map((tag, idx) => (
                                <span
                                  key={idx}
                                  className="text-[11px] px-2 py-0.5 rounded bg-ink-100 text-ink-700 font-medium"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                            <p className="text-xs text-ink-500 mt-1">
                              {item.subtitle} • {item.date}
                            </p>
                          </div>
                        </div>

                        {/* Actions: Delete & Fee */}
                        <div className="flex items-center gap-3 self-end sm:self-auto">
                          {item.cost && (
                            <span className="text-xs font-semibold text-ink-700">
                              PKR {item.cost.toLocaleString()}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(item)}
                            className="text-xs text-ink-400 hover:text-red-600 font-medium p-1 transition-colors"
                            title="Delete this record"
                          >
                            Delete
                          </button>
                        </div>
                      </div>

                      {/* Doctor Notes or Instructions */}
                      {item.notes && (
                        <div className="mt-3 pt-3 border-t border-ink-100 text-xs text-ink-700">
                          <span className="font-semibold text-ink-900">Notes: </span>
                          <span>{item.notes}</span>
                        </div>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete Timeline Record"
        description={`Are you sure you want to permanently delete "${deleteTarget?.title}" from ${deleteTarget?.date}? This cannot be undone.`}
        requiredPhrase="DELETE"
        tone="danger"
        confirmLabel="Permanently Delete"
        onConfirm={handleDeleteConfirm}
      />
    </AppShell>
  );
}
