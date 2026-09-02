import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { AppShell } from '../../components/layout/AppShell';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Field } from '../../components/ui/Field';
import { Input } from '../../components/ui/Input';
import { Textarea } from '../../components/ui/Textarea';
import { Dialog } from '../../components/ui/Dialog';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Toast } from '../../components/ui/Toast';
import { Skeleton } from '../../components/ui/Skeleton';
import {
  Stethoscope,
  Calendar,
  Building2,
  FileText,
  Pill,
  FlaskConical,
  CalendarClock,
  Edit3,
  Trash2,
  Printer,
  ArrowLeft,
  ExternalLink,
  Plus,
  AlertCircle,
  Eye,
  ChevronRight,
} from 'lucide-react';
import * as visitsRepo from '../../lib/db/visits';
import * as medicinesRepo from '../../lib/db/medicines';
import * as testOrdersRepo from '../../lib/db/testOrders';
import * as reportsRepo from '../../lib/db/reports';
import { todayInAppTz, fromAppDate } from '../../lib/time';
import type { Tables } from '../../lib/supabase/types';

function formatFullDate(dateStr: string): string {
  try {
    const d = fromAppDate(dateStr);
    return new Intl.DateTimeFormat('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(d);
  } catch {
    return dateStr;
  }
}

export function VisitDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [visit, setVisit] = useState<Tables<'visits'> | null>(null);
  const [medicines, setMedicines] = useState<Tables<'medicines'>[]>([]);
  const [testOrders, setTestOrders] = useState<Tables<'test_orders'>[]>([]);
  const [visitImages, setVisitImages] = useState<Tables<'visit_images'>[]>([]);
  const [reports, setReports] = useState<Tables<'reports'>[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editDoctorName, setEditDoctorName] = useState('');
  const [editClinicName, setEditClinicName] = useState('');
  const [editSpecialty, setEditSpecialty] = useState('');
  const [editVisitDate, setEditVisitDate] = useState('');
  const [editDiagnosis, setEditDiagnosis] = useState('');
  const [editAdvice, setEditAdvice] = useState('');
  const [editFollowUpDate, setEditFollowUpDate] = useState('');
  const [editCost, setEditCost] = useState('');
  const [editNotes, setEditNotes] = useState('');

  // Delete Dialog State
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // Image Lightbox State
  const [activeImage, setActiveImage] = useState<string | null>(null);

  // Notification Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const v = await visitsRepo.getVisitById(id);
      if (!v) {
        setLoadError('Doctor consultation record was not found or has been deleted.');
        setIsLoading(false);
        return;
      }
      setVisit(v);

      // Populate edit form
      setEditDoctorName(v.doctor_name || '');
      setEditClinicName(v.clinic_name || '');
      setEditSpecialty(v.specialty || '');
      setEditVisitDate(v.visit_date || '');
      setEditDiagnosis(v.diagnosis || '');
      setEditAdvice(v.doctor_advice || '');
      setEditFollowUpDate(v.follow_up_date || '');
      setEditCost(v.visit_cost ? String(v.visit_cost) : '');
      setEditNotes(v.notes || '');

      // Concurrently load related items
      const [allMeds, allOrders, images, allReports] = await Promise.all([
        medicinesRepo.listMedicines(v.profile_id),
        testOrdersRepo.listTestOrders(v.profile_id),
        visitsRepo.listVisitImages(v.id),
        reportsRepo.listReports(v.profile_id),
      ]);

      setMedicines(Array.isArray(allMeds) ? allMeds.filter((m) => m.visit_id === v.id) : []);
      setTestOrders(Array.isArray(allOrders) ? allOrders.filter((o) => o.visit_id === v.id) : []);
      setVisitImages(Array.isArray(images) ? images : []);
      setReports(Array.isArray(allReports) ? allReports : []);
    } catch (err) {
      console.error('Failed to load visit details:', err);
      setLoadError('Failed to load visit details. Please verify your connection.');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle Edit Submit
  const handleUpdateVisit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!visit) return;
    setIsSaving(true);
    try {
      const updated = await visitsRepo.updateVisit(visit.id, {
        doctor_name: editDoctorName.trim() || null,
        clinic_name: editClinicName.trim() || null,
        specialty: editSpecialty.trim() || null,
        visit_date: editVisitDate,
        diagnosis: editDiagnosis.trim() || null,
        doctor_advice: editAdvice.trim() || null,
        follow_up_date: editFollowUpDate || null,
        visit_cost: editCost ? parseFloat(editCost) : null,
        notes: editNotes.trim() || null,
      });

      setVisit(updated);
      setIsEditModalOpen(false);
      setToastMessage('Visit record updated successfully.');
    } catch (err) {
      console.error('Failed to update visit:', err);
      setToastMessage('Failed to update visit record.');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Delete
  const handleDeleteVisit = async () => {
    if (!visit) return;
    try {
      await visitsRepo.deleteVisit(visit.id);
      navigate('/timeline', { replace: true });
    } catch (err) {
      console.error('Failed to delete visit:', err);
      setToastMessage('Failed to delete consultation record.');
      setIsDeleteDialogOpen(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const today = todayInAppTz();

  const followUpStatus = useMemo(() => {
    if (!visit?.follow_up_date) return null;
    if (visit.follow_up_date < today) {
      return { label: 'Follow-up date passed', tone: 'neutral' as const };
    }
    if (visit.follow_up_date === today) {
      return { label: 'Follow-up due today', tone: 'attention' as const };
    }
    return { label: `Follow-up in ${visit.follow_up_date}`, tone: 'ok' as const };
  }, [visit?.follow_up_date, today]);

  if (isLoading) {
    return (
      <AppShell>
        <div className="space-y-6 max-w-4xl mx-auto py-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-24 rounded-xl" />
          </div>
          <Skeleton className="h-44 w-full rounded-3xl" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Skeleton className="h-64 rounded-2xl" />
            <Skeleton className="h-64 rounded-2xl" />
          </div>
        </div>
      </AppShell>
    );
  }

  if (loadError || !visit) {
    return (
      <AppShell>
        <div className="max-w-md mx-auto py-16 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-600 flex items-center justify-center mx-auto">
            <AlertCircle size={24} />
          </div>
          <h2 className="text-lg font-bold text-content">Consultation Not Found</h2>
          <p className="text-xs text-content-muted">{loadError || 'The requested doctor consultation does not exist.'}</p>
          <div className="pt-2">
            <Link to="/timeline">
              <Button size="sm" variant="secondary" leftIcon={<ArrowLeft size={14} />}>
                Back to Medical Timeline
              </Button>
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  const doctorCleanName = visit.doctor_name
    ? `Dr. ${visit.doctor_name.replace(/^dr\.?\s*/i, '')}`
    : 'Attending Physician';

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

      <div className="space-y-6 max-w-4xl mx-auto py-2">
        {/* Navigation Breadcrumb & Page Actions (Hidden on Print) */}
        <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
          <Link
            to="/timeline"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-content-muted hover:text-content transition-colors tap-spring"
          >
            <ArrowLeft size={14} />
            <span>Back to Timeline</span>
          </Link>

          <div className="flex items-center gap-2">
            <Link
              to={`/assistant?q=${encodeURIComponent(`Explain my consultation with ${doctorCleanName} on ${visit.visit_date} where diagnosis was ${visit.diagnosis || 'General'}. What should I keep in mind?`)}`}
            >
              <Button
                variant="secondary"
                size="sm"
                className="text-xs font-semibold tap-spring"
                leftIcon={<Stethoscope size={14} className="text-teal-600 dark:text-teal-400" />}
              >
                Clinical Summary
              </Button>
            </Link>

            <Button
              variant="secondary"
              size="sm"
              onClick={handlePrint}
              className="text-xs font-semibold tap-spring"
              leftIcon={<Printer size={14} />}
            >
              Print Record
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsEditModalOpen(true)}
              className="text-xs font-semibold tap-spring"
              leftIcon={<Edit3 size={14} />}
            >
              Edit
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsDeleteDialogOpen(true)}
              className="text-xs font-semibold text-rose-600 hover:bg-rose-500/10 tap-spring"
              leftIcon={<Trash2 size={14} />}
            >
              Delete
            </Button>
          </div>
        </div>

        {/* Executive Consultation Hero Banner */}
        <div className="p-5 sm:p-6 rounded-3xl bg-[#023b36] border border-[#0a544e]/70 shadow-[0_12px_32px_-8px_rgba(1,53,49,0.6)] text-white relative overflow-hidden">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
            {/* Left: Doctor & Clinic Header */}
            <div className="flex items-start sm:items-center gap-4">
              <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-[#00b59f] text-white flex items-center justify-center shrink-0 shadow-lg">
                <Stethoscope size={26} className="text-white" />
              </div>

              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                    {doctorCleanName}
                  </h1>
                  {visit.specialty && (
                    <span className="px-2.5 py-0.5 rounded-full bg-teal-400/20 text-[#00e5c9] text-xs font-semibold border border-teal-400/30">
                      {visit.specialty}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3 text-xs text-[#a0d7d2] mt-1 flex-wrap">
                  {visit.clinic_name && (
                    <span className="flex items-center gap-1">
                      <Building2 size={13} className="text-[#00e5c9]" />
                      <span>{visit.clinic_name}</span>
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Calendar size={13} className="text-[#00e5c9]" />
                    <span>{formatFullDate(visit.visit_date)}</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Right: Quick Doctor Directory Shortcut & Cost Badge */}
            <div className="flex sm:flex-col items-end gap-2 w-full sm:w-auto justify-between sm:justify-center shrink-0 border-t sm:border-t-0 border-[#09524c] pt-3 sm:pt-0">
              {visit.visit_cost ? (
                <div className="text-right">
                  <span className="text-[10px] uppercase font-semibold text-[#78c2ba] block">Consultation Fee</span>
                  <span className="text-lg font-black text-[#00e5c9]" data-numeric>
                    {visit.currency || 'PKR'} {Number(visit.visit_cost).toLocaleString()}
                  </span>
                </div>
              ) : (
                <div className="text-right">
                  <span className="text-[10px] uppercase font-semibold text-[#78c2ba] block">Consultation Type</span>
                  <span className="text-xs font-bold text-white">OPD Clinical Review</span>
                </div>
              )}

              {visit.doctor_name && (
                <Link
                  to={`/doctors?doctor=${encodeURIComponent(visit.doctor_name)}`}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#78c2ba] hover:text-white transition-colors print:hidden"
                >
                  <span>Doctor Profile</span>
                  <ChevronRight size={13} />
                </Link>
              )}
            </div>
          </div>

          {/* Diagnosis Pill Tag */}
          <div className="mt-4 pt-4 border-t border-[#09524c]/80 flex items-center justify-between flex-wrap gap-2 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[#78c2ba] font-medium">Clinical Diagnosis:</span>
              <span className="px-3 py-1 rounded-xl bg-[#012f2c] border border-[#09524c] text-white font-bold">
                {visit.diagnosis || 'General Consultation / Checkup'}
              </span>
            </div>

            {followUpStatus && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#a0d7d2]">
                <CalendarClock size={13} className="text-[#00e5c9]" />
                <span>Follow-up: <strong>{visit.follow_up_date}</strong></span>
              </span>
            )}
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Left 2 Columns: Clinical Advice, Notes, Prescribed Meds, Test Orders */}
          <div className="md:col-span-2 space-y-6">
            {/* Doctor's Advice & Assessment Card */}
            <Card className="p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-line">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-teal-500/10 text-teal-700 dark:text-teal-400 flex items-center justify-center">
                    <FileText size={16} />
                  </div>
                  <h2 className="text-sm font-bold uppercase tracking-wider text-content">
                    Doctor's Advice & Clinical Notes
                  </h2>
                </div>
                <span className="text-[11px] text-content-subtle font-medium">
                  Verified Clinical Record
                </span>
              </div>

              {visit.doctor_advice ? (
                <div className="p-4 rounded-2xl bg-teal-50/60 dark:bg-teal-950/20 border border-teal-200/80 dark:border-teal-800/40 text-content leading-relaxed text-xs sm:text-sm">
                  <p className="font-medium whitespace-pre-wrap">{visit.doctor_advice}</p>
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-surface-sunken text-content-subtle text-xs italic">
                  No specific dietary or lifestyle advice was recorded for this consultation.
                </div>
              )}

              {visit.notes && (
                <div className="space-y-1.5 pt-2">
                  <span className="text-xs font-semibold text-content-muted block">Additional Observations / Notes:</span>
                  <p className="text-xs text-content bg-surface-sunken p-3 rounded-xl border border-line whitespace-pre-wrap">
                    {visit.notes}
                  </p>
                </div>
              )}
            </Card>

            {/* Prescribed Medications for this Visit */}
            <Card className="p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-line">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-teal-500/10 text-teal-700 dark:text-teal-400 flex items-center justify-center">
                    <Pill size={16} />
                  </div>
                  <h2 className="text-sm font-bold uppercase tracking-wider text-content">
                    Prescribed Medications ({medicines.length})
                  </h2>
                </div>

                <Link
                  to="/medicines/cabinet"
                  className="text-xs font-semibold text-teal-700 dark:text-teal-400 hover:underline inline-flex items-center gap-1 print:hidden"
                >
                  <span>Medicine Cabinet</span>
                  <ChevronRight size={13} />
                </Link>
              </div>

              {medicines.length === 0 ? (
                <div className="py-6 text-center space-y-2">
                  <p className="text-xs text-content-subtle italic">
                    No medications were linked directly to this consultation visit.
                  </p>
                  <Link to="/prescriptions/new" className="print:hidden inline-block">
                    <Button size="sm" variant="ghost" className="text-xs" leftIcon={<Plus size={13} />}>
                      Scan or Add Prescription
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {medicines.map((med) => (
                    <div
                      key={med.id}
                      className="p-3.5 sm:p-4 rounded-2xl border border-line bg-surface-raised hover:border-teal-500/40 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Link
                            to={`/medicines/${med.id}`}
                            className="font-bold text-sm text-content hover:text-teal-700 dark:hover:text-teal-400 hover:underline flex items-center gap-1"
                          >
                            <span>{med.medicine_name}</span>
                            <span className="text-content-muted font-normal">{med.strength || ''}</span>
                            <ExternalLink size={12} className="text-content-subtle" />
                          </Link>

                          <Badge tone={med.is_ongoing ? 'info' : 'neutral'} size="sm">
                            {med.is_ongoing ? 'Ongoing' : med.duration_days ? `${med.duration_days} days` : 'Course'}
                          </Badge>
                        </div>

                        <div className="flex items-center gap-3 text-xs text-content-muted flex-wrap">
                          <span className="font-semibold text-teal-800 dark:text-teal-300">
                            {med.frequency_code || med.frequency_raw || 'As directed'}
                          </span>
                          <span>•</span>
                          <span>{med.dose_amount || '1 unit'}</span>
                          <span>•</span>
                          <span>{med.with_food ? 'Take with food' : 'Empty stomach / as advised'}</span>
                        </div>

                        {med.instructions && (
                          <p className="text-[11px] text-content-subtle italic mt-0.5">
                            "{med.instructions}"
                          </p>
                        )}
                      </div>

                      <div className="shrink-0 flex items-center gap-2 print:hidden">
                        <Link to={`/medicines/${med.id}`}>
                          <Button size="sm" variant="secondary" className="text-xs tap-spring">
                            Details
                          </Button>
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Diagnostic & Lab Test Orders */}
            <Card className="p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-line">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-700 dark:text-blue-400 flex items-center justify-center">
                    <FlaskConical size={16} />
                  </div>
                  <h2 className="text-sm font-bold uppercase tracking-wider text-content">
                    Diagnostic Lab Tests Ordered ({testOrders.length})
                  </h2>
                </div>

                <Link
                  to="/reports"
                  className="text-xs font-semibold text-blue-700 dark:text-blue-400 hover:underline inline-flex items-center gap-1 print:hidden"
                >
                  <span>All Lab Reports</span>
                  <ChevronRight size={13} />
                </Link>
              </div>

              {testOrders.length === 0 ? (
                <p className="text-xs text-content-subtle italic py-2">
                  No diagnostic laboratory tests were ordered in this consultation.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {testOrders.map((order) => {
                    const linkedReport = order.report_id
                      ? reports.find((r) => r.id === order.report_id)
                      : null;

                    return (
                      <div
                        key={order.id}
                        className="p-3.5 rounded-2xl border border-line bg-surface-raised flex items-center justify-between gap-3 shadow-2xs"
                      >
                        <div className="space-y-0.5 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-xs sm:text-sm text-content">
                              {order.test_name}
                            </span>
                            <Badge
                              tone={
                                order.status === 'completed'
                                  ? 'ok'
                                  : order.status === 'pending'
                                    ? 'warn'
                                    : 'neutral'
                              }
                              size="sm"
                            >
                              {order.status.toUpperCase()}
                            </Badge>
                          </div>

                          <p className="text-xs text-content-muted">
                            Ordered on {order.ordered_date}
                            {linkedReport && ` • Linked to report: ${linkedReport.title}`}
                          </p>
                        </div>

                        {linkedReport && (
                          <Link to="/reports" className="print:hidden shrink-0">
                            <Button size="sm" variant="secondary" className="text-xs">
                              View Report
                            </Button>
                          </Link>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>

          {/* Right Column: Metadata, Prescription Images, Follow-up card */}
          <div className="space-y-6">
            {/* Follow-up & Quick Summary Card */}
            <Card className="p-5 space-y-3.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-content">
                Consultation Overview
              </h3>

              <div className="space-y-2.5 text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-line">
                  <span className="text-content-muted">Consultation Date:</span>
                  <span className="font-bold text-content">{visit.visit_date}</span>
                </div>

                <div className="flex items-center justify-between pb-2 border-b border-line">
                  <span className="text-content-muted">Attending Doctor:</span>
                  <span className="font-bold text-content">{doctorCleanName}</span>
                </div>

                {visit.clinic_name && (
                  <div className="flex items-center justify-between pb-2 border-b border-line">
                    <span className="text-content-muted">Clinic / Facility:</span>
                    <span className="font-bold text-content text-right">{visit.clinic_name}</span>
                  </div>
                )}

                {visit.follow_up_date && (
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-300 space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider block">Next Follow-up Due</span>
                    <span className="text-xs font-bold block">{visit.follow_up_date}</span>
                    {followUpStatus && (
                      <span className="text-[11px] opacity-90 block">{followUpStatus.label}</span>
                    )}
                  </div>
                )}

                {visit.visit_cost && (
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-content-muted">Total Cost Paid:</span>
                    <span className="font-black text-teal-700 dark:text-teal-400" data-numeric>
                      {visit.currency || 'PKR'} {Number(visit.visit_cost).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            </Card>

            {/* Prescription Scans / Images Gallery */}
            <Card className="p-5 space-y-3.5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-content">
                  Prescription Scans ({visitImages.length})
                </h3>
              </div>

              {visitImages.length === 0 ? (
                <div className="p-4 rounded-xl bg-surface-sunken text-center space-y-1">
                  <FileText size={20} className="mx-auto text-content-subtle" />
                  <p className="text-xs text-content-subtle italic">No physical prescription scans attached.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2.5">
                  {visitImages.map((img) => (
                    <button
                      type="button"
                      key={img.id}
                      onClick={() => setActiveImage(img.storage_path)}
                      className="group relative rounded-xl border border-line overflow-hidden aspect-3/4 bg-surface-sunken cursor-pointer hover:border-teal-500 transition-all shadow-2xs text-left w-full p-0"
                    >
                      <img
                        src={img.storage_path}
                        alt={`Prescription page ${img.page_number}`}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                        <Eye size={18} />
                      </div>
                      <span className="absolute bottom-1.5 left-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-black/60 text-white">
                        Page {img.page_number}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </Card>

            {/* Quick Links Card */}
            <Card className="p-5 space-y-3 print:hidden">
              <h3 className="text-xs font-bold uppercase tracking-wider text-content">
                Doctor Dossier Tools
              </h3>

              <div className="space-y-2 text-xs">
                <Link
                  to="/doctor/brief"
                  className="flex items-center justify-between p-2.5 rounded-xl bg-surface-sunken hover:bg-surface-hover transition-colors font-medium text-content"
                >
                  <span className="flex items-center gap-2">
                    <FileText size={14} className="text-teal-600" />
                    <span>Print Full Clinical Dossier</span>
                  </span>
                  <ChevronRight size={13} className="text-content-subtle" />
                </Link>

                <Link
                  to="/doctors"
                  className="flex items-center justify-between p-2.5 rounded-xl bg-surface-sunken hover:bg-surface-hover transition-colors font-medium text-content"
                >
                  <span className="flex items-center gap-2">
                    <Stethoscope size={14} className="text-teal-600" />
                    <span>Doctor Directory</span>
                  </span>
                  <ChevronRight size={13} className="text-content-subtle" />
                </Link>
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Edit Consultation Modal */}
      <Dialog
        open={isEditModalOpen}
        onOpenChange={setIsEditModalOpen}
        title="Edit Consultation Record"
        description="Update physician details, clinical diagnosis, doctor's advice notes, or scheduled follow-up."
      >
        <form onSubmit={handleUpdateVisit} className="space-y-4">
          <Field id="edit-doc-name" label="Doctor Name" required>
            <Input
              value={editDoctorName}
              onChange={(e) => setEditDoctorName(e.target.value)}
              placeholder="e.g. Farooq"
              required
            />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field id="edit-clinic-name" label="Clinic / Hospital">
              <Input
                value={editClinicName}
                onChange={(e) => setEditClinicName(e.target.value)}
                placeholder="e.g. South City Hospital"
              />
            </Field>

            <Field id="edit-visit-date" label="Consultation Date" required>
              <Input
                type="date"
                value={editVisitDate}
                onChange={(e) => setEditVisitDate(e.target.value)}
                required
              />
            </Field>
          </div>

          <Field id="edit-diagnosis" label="Clinical Diagnosis">
            <Input
              value={editDiagnosis}
              onChange={(e) => setEditDiagnosis(e.target.value)}
              placeholder="e.g. Hypertension review, Root Canal"
            />
          </Field>

          <Field id="edit-advice" label="Doctor's Advice & Instructions">
            <Textarea
              rows={3}
              value={editAdvice}
              onChange={(e) => setEditAdvice(e.target.value)}
              placeholder="e.g. Reduce sodium intake, walk 30 mins daily"
            />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field id="edit-followup" label="Follow-up Date">
              <Input
                type="date"
                value={editFollowUpDate}
                onChange={(e) => setEditFollowUpDate(e.target.value)}
              />
            </Field>

            <Field id="edit-cost" label="Consultation Fee (PKR)">
              <Input
                type="number"
                value={editCost}
                onChange={(e) => setEditCost(e.target.value)}
                placeholder="e.g. 3000"
              />
            </Field>
          </div>

          <Field id="edit-notes" label="Additional Notes">
            <Textarea
              rows={2}
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              placeholder="Personal observations or reminders..."
            />
          </Field>

          <div className="pt-3 flex justify-end gap-2 border-t border-line">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsEditModalOpen(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={isSaving}>
              {isSaving ? 'Saving Changes...' : 'Save Consultation'}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Delete Consultation Dialog */}
      <ConfirmDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        title="Delete Consultation Record"
        description={`Are you sure you want to permanently delete this visit with ${doctorCleanName} on ${visit.visit_date}? This will also unlink attached medications.`}
        requiredPhrase="DELETE"
        tone="danger"
        confirmLabel="Permanently Delete Visit"
        onConfirm={handleDeleteVisit}
      />

      {/* Image Lightbox Modal */}
      {activeImage && (
        <Dialog
          open={Boolean(activeImage)}
          onOpenChange={(isOpen) => !isOpen && setActiveImage(null)}
          title="Prescription Scan Preview"
          className="max-w-3xl"
        >
          <div className="overflow-auto p-2 flex items-center justify-center max-h-[80vh]">
            <img
              src={activeImage}
              alt="Prescription full scan"
              className="max-h-[75vh] w-auto object-contain rounded-lg"
            />
          </div>
        </Dialog>
      )}
    </AppShell>
  );
}
