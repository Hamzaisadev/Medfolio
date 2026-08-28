import { useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AppShell } from '../../components/layout/AppShell';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Field } from '../../components/ui/Field';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Textarea } from '../../components/ui/Textarea';
import { Badge } from '../../components/ui/Badge';
import { Disclaimer } from '../../components/ui/Disclaimer';
import { MedicalDatePicker } from '../../components/ui/MedicalDatePicker';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import {
  ClockIcon,
  PlusIcon,
  SearchIcon,
  TrashIcon,
  CheckIcon,
} from '../../components/ui/icons';
import { useAuth } from '../../lib/auth/AuthContext';
import {
  parseFrequency,
  defaultDoseTimes,
} from '../../domain/frequency';
import { parseDuration, computeEndDate } from '../../domain/duration';
import { buildSchedule } from '../../domain/schedule';
import { todayInAppTz, formatMinutesTo24h } from '../../lib/time';
import { EXTRACTION_DISCLAIMER } from '../../lib/disclaimer';
import { visitsRepo, medicinesRepo, dosesRepo, testOrdersRepo, extractionAuditRepo } from '../../lib/db';
import { readInventory, writeInventory } from '../../lib/inventory';
import { newId } from '../../lib/db/localStore';
import type { Json } from '../../lib/supabase/types';
import type { ExtractPrescriptionResponse } from '../../../api/_lib/schemas';
import type { ProcessedImage } from '../../lib/files/imagePipeline';

interface MedicineDraft {
  id: string;
  medicine_name: string;
  strength?: string;
  form?: string;
  dose_amount?: string;
  frequency_raw?: string;
  duration_raw?: string;
  instructions?: string;
  /** null = the prescription did not state a meal relation. */
  with_food?: boolean | null;
  is_ongoing?: boolean;
  confidence?: 'high' | 'low';
}

interface TestOrderDraft {
  id: string;
  test_name: string;
  confidence?: 'high' | 'low';
}

const DOSAGE_FORMS = [
  { value: 'Tablet', label: 'Tablet' },
  { value: 'Capsule', label: 'Capsule' },
  { value: 'Syrup', label: 'Syrup' },
  { value: 'Drops', label: 'Drops' },
  { value: 'Injection', label: 'Injection' },
  { value: 'Inhaler', label: 'Inhaler' },
  { value: 'Ointment', label: 'Ointment / Cream' },
  { value: 'Suspension', label: 'Suspension' },
  { value: 'Gel', label: 'Gel' },
  { value: 'Other', label: 'Other' },
];

const FREQUENCY_OPTIONS = [
  { value: 'BD', label: 'Twice daily (Morning & Night)' },
  { value: 'OD', label: 'Once daily (Morning)' },
  { value: 'TDS', label: '3 times daily (TDS)' },
  { value: 'QHS', label: 'Once daily (At bedtime)' },
  { value: 'QID', label: '4 times daily (QID)' },
  { value: 'PRN', label: 'As needed (PRN)' },
  { value: 'WEEKLY', label: 'Once weekly' },
  { value: 'CUSTOM', label: 'Custom routine...' },
];

export function ReviewPrescriptionPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const state = location.state as {
    draft?: ExtractPrescriptionResponse;
    rawResponse?: unknown;
    model?: string;
    images?: ProcessedImage[];
    manual?: boolean;
  } | null;

  const initialDraft = state?.draft;
  const images = state?.images || [];

  // Stable per-mount id so the initial draft rows get unique React keys without
  // relying on Date.now(), which collides for rows created in the same tick.
  const draftSessionId = useRef(newId()).current;

  // Form State
  const [doctorName, setDoctorName] = useState(initialDraft?.doctor_name || '');
  const [clinicName, setClinicName] = useState(initialDraft?.clinic_name || '');
  const [visitDate, setVisitDate] = useState(
    initialDraft?.visit_date?.trim() || todayInAppTz()
  );
  const [scheduleStartDate, setScheduleStartDate] = useState(todayInAppTz());
  const [diagnosis, setDiagnosis] = useState(initialDraft?.diagnosis || '');
  const [doctorAdvice, setDoctorAdvice] = useState(initialDraft?.doctor_advice || '');
  const [followUpDate, setFollowUpDate] = useState(initialDraft?.follow_up || '');
  const [visitCost, setVisitCost] = useState<string>('');

  // Discard Confirmation Modal State
  const [isDiscardDialogOpen, setIsDiscardDialogOpen] = useState(false);



  // Image Viewer & Hover Zoom State
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isHoverZooming, setIsHoverZooming] = useState(false);
  const [zoomLevel, setZoomLevel] = useState<number>(2.5);
  const [zoomOrigin, setZoomOrigin] = useState<{ x: number; y: number }>({ x: 50, y: 50 });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const imageContainerRef = useRef<HTMLDivElement>(null);

  const handleImageMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!imageContainerRef.current) return;
    const rect = imageContainerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setZoomOrigin({
      x: Math.max(0, Math.min(100, x)),
      y: Math.max(0, Math.min(100, y)),
    });
  };

  // Medicines List
  const [medicines, setMedicines] = useState<MedicineDraft[]>(
    (initialDraft?.medicines || []).map((m, idx) => {
      let withFood = m.with_food ?? null;
      if (withFood === null && m.instructions) {
        const inst = m.instructions.toLowerCase();
        if (inst.includes('after') || inst.includes('with meal') || inst.includes('with food')) {
          withFood = true;
        } else if (inst.includes('before') || inst.includes('empty stomach')) {
          withFood = false;
        }
      }

      return {
        id: `draft-${idx}-${draftSessionId}`,
        medicine_name: m.medicine_name || '',
        strength: m.strength || '',
        form: m.form || 'tablet',
        dose_amount: m.dose_amount || '',
        frequency_raw: m.frequency_raw || '',
        duration_raw: m.duration_raw || '',
        instructions: m.instructions || '',
        with_food: withFood,
        is_ongoing: false,
        confidence: m.confidence || 'high',
      };
    })
  );

  // Ordered Diagnostic Tests List
  const [tests, setTests] = useState<TestOrderDraft[]>(
    (initialDraft?.tests_ordered || []).map((t, idx) => ({
      id: `test-${idx}-${draftSessionId}`,
      test_name: typeof t === 'string' ? t : (t as { test_name?: string }).test_name || '',
      confidence: 'high',
    }))
  );

  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Medicine Actions
  const handleAddMedicine = () => {
    const nid = newId();
    setMedicines((prev) => [
      ...prev,
      {
        id: nid,
        medicine_name: '',
        strength: '',
        form: 'tablet',
        dose_amount: '',
        frequency_raw: '',
        duration_raw: '',
        with_food: null,
        is_ongoing: false,
        confidence: 'high',
      },
    ]);
  };

  const handleUpdateMedicine = (id: string, updates: Partial<MedicineDraft>) => {
    setMedicines((prev) =>
      prev.map((m) => (m.id === id ? { ...m, ...updates } : m))
    );
  };

  const handleRemoveMedicine = (id: string) => {
    setMedicines((prev) => prev.filter((m) => m.id !== id));
  };

  // Test Actions
  const handleAddTest = () => {
    setTests((prev) => [
      ...prev,
      {
        id: newId(),
        test_name: '',
        confidence: 'high',
      },
    ]);
  };

  const handleUpdateTest = (id: string, name: string) => {
    setTests((prev) =>
      prev.map((t) => (t.id === id ? { ...t, test_name: name } : t))
    );
  };

  const handleRemoveTest = (id: string) => {
    setTests((prev) => prev.filter((t) => t.id !== id));
  };

  /**
   * Saves the visit, its medicines and their generated dose schedule.
   *
   * Not a single transaction: Supabase is reached over separate REST calls, so a
   * failure part-way leaves earlier rows saved. Frequency and duration are
   * therefore validated up front, before anything is written, and the error
   * message tells the patient that partial records may exist.
   */
  const handleSave = async () => {
    setErrorMessage(null);

    // Filter out completely empty medicine drafts
    const validMedicines = medicines.filter((m) => m.medicine_name && m.medicine_name.trim().length > 0);

    // A frequency or duration we cannot interpret must be corrected by the
    // patient, never guessed. Silently defaulting to OD / 5 days turned an
    // unreadable "TDS" into a third of the prescribed dose.
    const unresolved = validMedicines.filter((m) => {
      const freq = parseFrequency(m.frequency_raw);
      if (!freq) return true;
      if (freq === 'PRN' || freq === 'SOS' || m.is_ongoing) return false;
      return parseDuration(m.duration_raw).kind !== 'days';
    });

    if (unresolved.length > 0) {
      const names = unresolved.map((m) => m.medicine_name.trim()).join(', ');
      setErrorMessage(
        `Please set a frequency and duration we can read for: ${names}. ` +
          'Use a form like "1+0+1", "BD", "TDS" or "PRN", and a duration like "5 days" or "2 weeks" ' +
          '(or tick Ongoing). Nothing is saved until these are resolved.'
      );
      return;
    }

    const effectiveVisitDate = visitDate || todayInAppTz();
    const effectiveUserId = user?.id || profile?.user_id || '';
    const effectiveProfileId = profile?.id || effectiveUserId;

    setIsSaving(true);

    try {
      // Step 1: Create Doctor Visit Record
      const visit = await visitsRepo.createVisit({
        user_id: effectiveUserId,
        profile_id: effectiveProfileId,
        doctor_name: doctorName?.trim() || 'Consulting Physician',
        clinic_name: clinicName?.trim() || null,
        visit_date: effectiveVisitDate,
        diagnosis: diagnosis?.trim() || null,
        doctor_advice: doctorAdvice?.trim() || null,
        follow_up_date: followUpDate || null,
        visit_cost: visitCost ? parseFloat(visitCost) : null,
        currency: 'PKR',
      });

      // Step 2: Insert Medicines & Generate Schedules
      const pillInventoryMap = readInventory(effectiveProfileId);
      const effectiveStartDate = scheduleStartDate || todayInAppTz();

      for (const med of validMedicines) {
        // Validated above, so this cannot be null.
        const freqCode = parseFrequency(med.frequency_raw)!;
        const dur = parseDuration(med.duration_raw);

        const isOngoing = med.is_ongoing ?? dur.kind === 'ongoing';
        const durationDays = dur.kind === 'days' ? dur.days : null;

        const endDate =
          durationDays !== null && !isOngoing
            ? computeEndDate(effectiveStartDate, durationDays)
            : null;

        const defaultTimes = defaultDoseTimes(freqCode, med.with_food, med.frequency_raw);

        const createdMed = await medicinesRepo.createMedicine({
          user_id: effectiveUserId,
          profile_id: effectiveProfileId,
          visit_id: visit.id,
          medicine_name: med.medicine_name.trim(),
          strength: med.strength?.trim() || null,
          form: med.form || 'tablet',
          dose_amount: med.dose_amount?.trim() || null,
          frequency_code: freqCode,
          frequency_raw: med.frequency_raw?.trim() || null,
          with_food: med.with_food ?? null,
          duration_days: durationDays,
          start_date: effectiveStartDate,
          end_date: endDate,
          is_ongoing: isOngoing,
          instructions: med.instructions || null,
        });

        // Initialize pill inventory count (e.g. standard pack of 20 pills)
        if (createdMed.id && !pillInventoryMap[createdMed.id]) {
          pillInventoryMap[createdMed.id] = durationDays
            ? durationDays * (defaultTimes.length || 1) + 4
            : 20;
        }

        // Generate automated deterministic dose rows if not PRN
        if (defaultTimes.length > 0) {
          const doseRows = buildSchedule({
            medicineId: createdMed.id,
            startDate: effectiveStartDate,
            durationDays,
            isOngoing,
            doseTimes: defaultTimes,
            now: new Date(),
            // Drives the repeat interval: WEEKLY every 7 days, STAT once.
            frequencyCode: freqCode,
          });

          if (doseRows.length > 0) {
            await dosesRepo.createDoses(
              doseRows.map((d) => ({
                user_id: effectiveUserId,
                profile_id: effectiveProfileId,
                medicine_id: createdMed.id,
                scheduled_date: d.scheduled_date,
                scheduled_minutes: d.scheduled_minutes,
                status: 'pending',
              }))
            );
          }
        }
      }

      // Save pill inventory
      writeInventory(effectiveProfileId, pillInventoryMap);

      // Step 3: Insert Ordered Tests
      for (const t of tests) {
        if (t.test_name && t.test_name.trim()) {
          try {
            await testOrdersRepo.createTestOrder({
              user_id: effectiveUserId,
              profile_id: effectiveProfileId,
              visit_id: visit.id,
              test_name: t.test_name.trim(),
              status: 'pending',
              ordered_date: effectiveVisitDate,
              currency: 'PKR',
            });
          } catch (tErr) {
            console.warn('Test order creation notice:', tErr);
          }
        }
      }

      // Step 4: Extraction Audit Logging (Optional / non-blocking)
      if (state?.rawResponse) {
        try {
          await extractionAuditRepo.logExtractionAudit({
            user_id: effectiveUserId,
            entity_type: 'visit',
            entity_id: visit.id,
            model: state.model || 'prescription-reader',
            raw_response: state.rawResponse as Json,
            confirmed_data: {
              doctor_name: doctorName,
              clinic_name: clinicName,
              visit_date: effectiveVisitDate,
              medicines_count: validMedicines.length,
            } as Json,
            edited_fields: [],
          });
        } catch (auditErr) {
          console.warn('Audit logging notice:', auditErr);
        }
      }

      // Navigate straight to the cabinet and let it own the confirmation: a toast
      // set immediately before navigating never renders.
      navigate('/medicines', {
        replace: true,
        state: { flash: 'Prescription and schedule saved successfully.' },
      });
    } catch (err: unknown) {
      console.error('Save prescription error:', err);
      const msg = err instanceof Error ? err.message : 'Failed to save prescription. Please check fields.';
      setErrorMessage(
        `${msg} Some records may already have been saved — check your medicine cabinet before retrying.`
      );
    } finally {
      setIsSaving(false);
    }
  };

  const activeImg = images[activeImageIndex];

  return (
    <AppShell>
      <PageHeader
        title="Review Prescription"
        description="Verify and edit the details before generating your medicine schedule."
        action={
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => navigate(-1)} disabled={isSaving}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSave} loading={isSaving}>
              Confirm & Save Schedule
            </Button>
          </div>
        }
      />

      {errorMessage && (
        <div className="mb-6 rounded-[var(--radius-lg)] border border-risk-border bg-risk-bg p-4 text-sm text-risk-text flex items-center justify-between">
          <span>{errorMessage}</span>
          <button type="button" onClick={() => setErrorMessage(null)} className="font-bold">
            ×
          </button>
        </div>
      )}

      {/* Main 2-Column Split: Original Prescription Image + Form Fields */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (5/12): Sticky Prescription Photo Viewer & Visit Details */}
        <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-20">
          {/* Prescription Photo Card with Interactive Hover Magnifier */}
          {activeImg && (
            <Card
              header={
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-content">Original Prescription</h2>
                    <span className="text-2xs px-2.5 py-0.5 rounded-full bg-accent-subtle text-accent font-bold border border-line">
                      Page {activeImageIndex + 1}/{images.length}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Zoom multiplier chips */}
                    <div className="flex items-center bg-surface-sunken p-1 rounded-xl border border-line text-xs font-semibold text-content-muted">
                      {[2, 2.5, 3.5].map((level) => (
                        <button
                          key={level}
                          type="button"
                          onClick={() => setZoomLevel(level)}
                          className={`px-2 py-0.5 rounded-lg text-xs font-bold transition-all ${
                            zoomLevel === level
                              ? 'bg-surface-raised text-accent shadow-xs border border-line'
                              : 'hover:text-content'
                          }`}
                        >
                          {level}x
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(true)}
                      className="text-xs text-accent hover:underline font-bold px-2 py-1"
                    >
                      Fullscreen
                    </button>
                  </div>
                </div>
              }
            >
              <div className="space-y-3">
                {/* Active Image Box with Dynamic Hover Zoom */}
                <div
                  ref={imageContainerRef}
                  onMouseEnter={() => setIsHoverZooming(true)}
                  onMouseLeave={() => setIsHoverZooming(false)}
                  onMouseMove={handleImageMouseMove}
                  className="relative w-full h-[420px] rounded-[var(--radius-md)] border border-line bg-surface-sunken overflow-hidden flex items-center justify-center cursor-crosshair select-none group"
                >
                  <img
                    src={`data:${activeImg.mimeType};base64,${activeImg.dataBase64}`}
                    alt={`Prescription page ${activeImageIndex + 1}`}
                    className="w-full h-full object-contain pointer-events-none transition-transform duration-75 ease-out"
                    style={{
                      transformOrigin: `${zoomOrigin.x}% ${zoomOrigin.y}%`,
                      transform: isHoverZooming ? `scale(${zoomLevel})` : 'scale(1)',
                    }}
                  />

                  {/* Subtle hover helper badge */}
                  {!isHoverZooming && (
                    <div className="absolute bottom-2 right-2 bg-surface-raised/90 backdrop-blur-xs text-content-muted text-2xs font-semibold px-3 py-1.5 rounded-full pointer-events-none flex items-center gap-1.5 shadow-card border border-line">
                      <SearchIcon size={13} className="text-accent" />
                      Hover to magnify handwriting
                    </div>
                  )}

                  {isHoverZooming && (
                    <div className="absolute top-2 left-2 bg-accent text-content-onaccent text-2xs font-bold px-2.5 py-1 rounded-lg shadow-card pointer-events-none">
                      {zoomLevel}x Magnified
                    </div>
                  )}
                </div>

                {/* Multiple Pages Selector Thumbnails */}
                {images.length > 1 && (
                  <div className="flex items-center gap-2 overflow-x-auto pt-1 pb-1">
                    {images.map((img, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setActiveImageIndex(idx)}
                        className={`relative rounded-xl border-2 overflow-hidden w-14 h-14 shrink-0 transition-all ${
                          activeImageIndex === idx
                            ? 'border-accent ring-2 ring-accent-subtle scale-105 shadow-sm'
                            : 'border-line opacity-60 hover:opacity-100'
                        }`}
                      >
                        <img
                          src={`data:${img.mimeType};base64,${img.dataBase64}`}
                          alt={`Thumbnail ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Doctor & Visit Summary Card */}
          <Card header={<h2 className="text-base font-bold text-content">Visit Information</h2>}>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field id="rev-doctor" label="Doctor Name">
                  <Input
                    value={doctorName}
                    onChange={(e) => setDoctorName(e.target.value)}
                    placeholder="e.g. Dr. Joynal Abedin"
                  />
                </Field>

                <Field id="rev-clinic" label="Clinic / Hospital">
                  <Input
                    value={clinicName}
                    onChange={(e) => setClinicName(e.target.value)}
                    placeholder="e.g. Trauma Center"
                  />
                </Field>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field id="rev-date" label="Visit Date" required>
                  <MedicalDatePicker
                    id="rev-date"
                    value={visitDate}
                    onChange={setVisitDate}
                    mode="recent"
                  />
                </Field>

                <Field id="rev-sched-start" label="Schedule Starts On" required>
                  <MedicalDatePicker
                    id="rev-sched-start"
                    value={scheduleStartDate}
                    onChange={setScheduleStartDate}
                    mode="recent"
                  />
                </Field>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field id="rev-diag" label="Diagnosis">
                  <Input
                    value={diagnosis}
                    onChange={(e) => setDiagnosis(e.target.value)}
                    placeholder="e.g. Right knee pain, Hypertension"
                  />
                </Field>

                <Field id="rev-followup" label="Follow-up Date">
                  <MedicalDatePicker
                    id="rev-followup"
                    value={followUpDate}
                    onChange={setFollowUpDate}
                    mode="recent"
                  />
                </Field>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field id="rev-advice" label="Doctor's Advice / Notes">
                  <Textarea
                    value={doctorAdvice}
                    onChange={(e) => setDoctorAdvice(e.target.value)}
                    placeholder="e.g. Steam inhalation, rest, avoid cold drinks"
                    rows={2}
                  />
                </Field>

                <Field id="rev-cost" label="Visit Fee (PKR)">
                  <Input
                    type="number"
                    value={visitCost}
                    onChange={(e) => setVisitCost(e.target.value)}
                    placeholder="e.g. 2500"
                  />
                </Field>
              </div>
            </div>
          </Card>
        </div>

        {/* Right Column (7/12): Medicines & Test Orders */}
        <div className="lg:col-span-7 space-y-6">
          {/* Medicines Section */}
          <Card
            header={
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-content">Prescribed Medicines ({medicines.length})</h2>
                  <p className="text-xs text-content-muted">Review extracted routines and dosing schedule.</p>
                </div>
                <Button variant="secondary" size="sm" onClick={handleAddMedicine} leftIcon={<PlusIcon size={14} />}>
                  Add Medicine
                </Button>
              </div>
            }
          >
            <div className="space-y-4">
              {medicines.length === 0 ? (
                <div className="text-center py-10 text-sm text-content-muted">
                  No medicines added yet. Click "+ Add Medicine" above.
                </div>
              ) : (
                medicines.map((m, idx) => {
                  const isLowConf = m.confidence === 'low';
                  const freqCode = parseFrequency(m.frequency_raw);
                  const durResult = parseDuration(m.duration_raw);
                  const doseTimes = defaultDoseTimes(freqCode, m.with_food, m.frequency_raw);

                  return (
                    <div
                      key={m.id}
                      className={`p-4 sm:p-5 rounded-2xl border ${
                        isLowConf
                          ? 'border-warn-border bg-warn-bg/10'
                          : 'border-line-strong bg-surface-raised'
                      } space-y-3.5 shadow-2xs hover:border-accent/40 transition-all`}
                    >
                      {/* Medicine Card Top Header */}
                      <div className="flex items-center justify-between pb-2.5 border-b border-line">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="w-6 h-6 rounded-lg bg-accent text-accent-onaccent flex items-center justify-center font-bold text-xs shadow-2xs shrink-0">
                            {idx + 1}
                          </span>
                          <span className="text-sm font-bold text-content truncate">
                            {m.medicine_name.trim() || `Prescribed Medicine #${idx + 1}`}
                          </span>
                          {isLowConf && (
                            <Badge tone="warn" size="sm" className="shrink-0">
                              Verify Details
                            </Badge>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveMedicine(m.id)}
                          className="text-xs text-risk-text hover:bg-risk-bg px-2 py-1 rounded-md font-bold flex items-center gap-1.5 transition-colors shrink-0 cursor-pointer"
                          title="Remove this medicine"
                        >
                          <TrashIcon size={13} />
                          <span>Remove</span>
                        </button>
                      </div>

                      {/* Row 1: Medicine Name (6 cols), Strength (3 cols), Form (3 cols) */}
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                        <div className="sm:col-span-6">
                          <Field id={`med-name-${m.id}`} label="Medicine Name" required>
                            <Input
                              value={m.medicine_name}
                              onChange={(e) => handleUpdateMedicine(m.id, { medicine_name: e.target.value })}
                              placeholder="e.g. Sizodon Plus, Augmentin"
                            />
                          </Field>
                        </div>
                        <div className="sm:col-span-3">
                          <Field id={`med-strength-${m.id}`} label="Strength">
                            <Input
                              value={m.strength || ''}
                              onChange={(e) => handleUpdateMedicine(m.id, { strength: e.target.value })}
                              placeholder="e.g. 500mg, 10ml"
                            />
                          </Field>
                        </div>
                        <div className="sm:col-span-3">
                          <Field id={`med-form-${m.id}`} label="Dosage Form">
                            <Select
                              value={
                                DOSAGE_FORMS.find((f) =>
                                  (m.form || '').toLowerCase().includes(f.value.toLowerCase())
                                )?.value ||
                                m.form ||
                                'Tablet'
                              }
                              onChange={(e) => handleUpdateMedicine(m.id, { form: e.target.value })}
                              options={DOSAGE_FORMS}
                            />
                          </Field>
                        </div>
                      </div>

                      {/* Row 2: Frequency & Duration (Perfect vertical & baseline alignment) */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* Frequency Column */}
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center justify-between min-h-[20px]">
                            <label htmlFor={`med-freq-${m.id}`} className="text-sm font-semibold text-content">
                              Frequency <span className="text-risk-text" aria-hidden="true">*</span>
                            </label>
                            {doseTimes.length > 0 && (
                              <span className="text-xs font-semibold text-accent flex items-center gap-1">
                                <ClockIcon size={12} className="shrink-0" />
                                {doseTimes.map((t) => formatMinutesTo24h(t)).join(', ')}
                              </span>
                            )}
                          </div>
                          <Select
                            id={`med-freq-${m.id}`}
                            value={freqCode || 'CUSTOM'}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === 'BD') handleUpdateMedicine(m.id, { frequency_raw: 'Morning & Night (Twice daily)' });
                              else if (val === 'OD') handleUpdateMedicine(m.id, { frequency_raw: 'Once daily (Morning)' });
                              else if (val === 'TDS') handleUpdateMedicine(m.id, { frequency_raw: '3 times daily (Morning, Afternoon & Night)' });
                              else if (val === 'QHS') handleUpdateMedicine(m.id, { frequency_raw: 'Night at bedtime' });
                              else if (val === 'QID') handleUpdateMedicine(m.id, { frequency_raw: '4 times daily' });
                              else if (val === 'PRN') handleUpdateMedicine(m.id, { frequency_raw: 'As needed (PRN)' });
                              else if (val === 'WEEKLY') handleUpdateMedicine(m.id, { frequency_raw: 'Once weekly' });
                              else handleUpdateMedicine(m.id, { frequency_raw: '' });
                            }}
                            options={FREQUENCY_OPTIONS}
                          />
                          {(!freqCode || freqCode === 'CUSTOM') && (
                            <Input
                              value={m.frequency_raw || ''}
                              onChange={(e) => handleUpdateMedicine(m.id, { frequency_raw: e.target.value })}
                              placeholder="Type custom routine (e.g. Alternate days)"
                            />
                          )}
                        </div>

                        {/* Duration Column */}
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center justify-between min-h-[20px]">
                            <label htmlFor={`med-dur-${m.id}`} className="text-sm font-semibold text-content">
                              Duration {!m.is_ongoing && <span className="text-risk-text" aria-hidden="true">*</span>}
                              {durResult.kind === 'days' && (
                                <span className="ml-1 text-xs font-normal text-content-subtle">
                                  ({durResult.days} days)
                                </span>
                              )}
                            </label>
                            <label className="flex items-center gap-1.5 cursor-pointer text-content font-bold text-xs select-none">
                              <input
                                type="checkbox"
                                checked={m.is_ongoing || false}
                                onChange={(e) =>
                                  handleUpdateMedicine(m.id, {
                                    is_ongoing: e.target.checked,
                                    duration_raw: e.target.checked ? 'Ongoing' : '',
                                  })
                                }
                                className="rounded text-accent focus:ring-accent"
                              />
                              Ongoing
                            </label>
                          </div>

                          <div className="relative flex items-center w-full">
                            <Input
                              id={`med-dur-${m.id}`}
                              value={m.duration_raw || ''}
                              onChange={(e) => handleUpdateMedicine(m.id, { duration_raw: e.target.value })}
                              placeholder={m.is_ongoing ? 'Ongoing medication' : 'e.g. 5 days, 1 month'}
                              disabled={m.is_ongoing}
                              className={!m.is_ongoing ? 'pr-40' : ''}
                            />
                            {!m.is_ongoing && (
                              <div className="absolute right-1.5 flex items-center gap-1">
                                {['3d', '5d', '7d', '14d', '1m'].map((dLabel) => {
                                  const fullDur =
                                    dLabel === '3d'
                                      ? '3 days'
                                      : dLabel === '5d'
                                        ? '5 days'
                                        : dLabel === '7d'
                                          ? '7 days'
                                          : dLabel === '14d'
                                            ? '14 days'
                                            : '1 month';
                                  return (
                                    <button
                                      key={dLabel}
                                      type="button"
                                      onClick={() => handleUpdateMedicine(m.id, { duration_raw: fullDur })}
                                      className="h-7 px-1.5 text-[11px] font-semibold rounded bg-surface-sunken hover:bg-accent/15 hover:text-accent border border-line text-content-muted transition-colors cursor-pointer"
                                    >
                                      {dLabel}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Row 3: Meal Timing & Special Instructions (Uniform h-12 height across both columns!) */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="flex flex-col gap-2">
                          <label className="text-sm font-semibold text-content min-h-[20px] flex items-center">
                            Meal Timing
                          </label>
                          <div className="h-12 p-1 bg-surface-sunken border border-line-strong rounded-[var(--radius-md)] grid grid-cols-3 gap-1 items-center">
                            {[
                              { label: 'After Food', val: true },
                              { label: 'Before Food', val: false },
                              { label: 'Anytime', val: null },
                            ].map((opt) => (
                              <button
                                key={String(opt.val)}
                                type="button"
                                onClick={() => handleUpdateMedicine(m.id, { with_food: opt.val })}
                                className={`h-full rounded-md text-xs font-semibold flex items-center justify-center transition-all cursor-pointer select-none ${
                                  m.with_food === opt.val
                                    ? 'bg-accent text-accent-onaccent shadow-xs font-bold'
                                    : 'text-content-muted hover:text-content hover:bg-surface-raised'
                                }`}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="flex flex-col gap-2">
                          <label htmlFor={`med-inst-${m.id}`} className="text-sm font-semibold text-content min-h-[20px] flex items-center">
                            Special Instructions
                          </label>
                          <Input
                            id={`med-inst-${m.id}`}
                            value={m.instructions || ''}
                            onChange={(e) => handleUpdateMedicine(m.id, { instructions: e.target.value })}
                            placeholder="e.g. Take with warm water, avoid dairy"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </Card>

          {/* Ordered Lab Tests Section */}
          <Card
            header={
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-content">
                    Ordered Lab Tests / Investigations ({tests.length})
                  </h2>
                  <p className="text-xs text-content-muted">Diagnostic lab tests prescribed during this visit.</p>
                </div>
                <Button variant="secondary" size="sm" onClick={handleAddTest} leftIcon={<PlusIcon size={14} />}>
                  Add Test
                </Button>
              </div>
            }
          >
            <div className="space-y-3">
              {tests.length === 0 ? (
                <div className="text-center py-6 text-xs text-content-subtle">
                  No diagnostic tests were detected or added.
                </div>
              ) : (
                tests.map((t, idx) => (
                  <div
                    key={t.id}
                    className="p-3 rounded-xl border border-line bg-surface-raised flex items-center justify-between gap-3 shadow-xs"
                  >
                    <div className="flex-1">
                      <Input
                        value={t.test_name}
                        onChange={(e) => handleUpdateTest(t.id, e.target.value)}
                        placeholder={`Test #${idx + 1} (e.g. CBC, Serum Creatinine)`}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveTest(t.id)}
                      className="text-xs text-risk-text hover:underline font-bold px-2 py-1 shrink-0 flex items-center gap-1"
                    >
                      <TrashIcon size={13} />
                      Remove
                    </button>
                  </div>
                ))
              )}
            </div>
          </Card>

          {/* Clinical Disclaimer per 05-SAFETY-AND-COMPLIANCE.md */}
          <Disclaimer text={EXTRACTION_DISCLAIMER} />

          {/* Bottom Card Action Button */}
          <div className="pt-2">
            <Button
              variant="primary"
              size="lg"
              fullWidth
              onClick={handleSave}
              loading={isSaving}
              leftIcon={<CheckIcon size={18} />}
            >
              Confirm & Save Prescription Schedule
            </Button>
          </div>
        </div>
      </div>

      {/* Sticky Bottom Floating Dock — Always visible while scrolling */}
      <div className="sticky bottom-0 left-0 right-0 bg-surface/95 backdrop-blur-md border-t border-line py-3.5 px-4 sm:px-6 shadow-raise z-30 flex items-center justify-between gap-4 -mx-4 sm:-mx-6 mt-8">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-accent animate-pulse" />
          <span className="text-xs sm:text-sm font-bold text-content">
            {medicines.filter((m) => m.medicine_name.trim()).length} Medicines & {tests.filter((t) => t.test_name.trim()).length} Tests
          </span>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsDiscardDialogOpen(true)}
            disabled={isSaving}
          >
            Discard
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={handleSave}
            loading={isSaving}
            leftIcon={<CheckIcon size={16} />}
          >
            Confirm & Save Schedule
          </Button>
        </div>
      </div>

      {/* Discard Confirmation Dialog */}
      <ConfirmDialog
        open={isDiscardDialogOpen}
        onOpenChange={setIsDiscardDialogOpen}
        title="Discard Prescription Draft?"
        description="Are you sure you want to discard this prescription draft? All extracted medicines, dosages, and notes will be lost."
        confirmLabel="Yes, Discard"
        cancelLabel="Keep Reviewing"
        tone="danger"
        onConfirm={() => {
          setIsDiscardDialogOpen(false);
          navigate(-1);
        }}
      />

      {/* Fullscreen High-Resolution Lightbox Modal */}
      {isModalOpen && activeImg && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-ink-900/90 backdrop-blur-md flex flex-col items-center justify-center p-4"
          onClick={() => setIsModalOpen(false)}
        >
          <div className="relative max-w-5xl max-h-[90vh] w-full flex flex-col items-center">
            <div className="w-full flex items-center justify-between text-white mb-2">
              <span className="text-sm font-semibold">
                Page {activeImageIndex + 1} of {images.length}
              </span>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-3 py-1 bg-white/20 hover:bg-white/30 rounded text-sm font-bold"
              >
                Close (Esc)
              </button>
            </div>
            <img
              src={`data:${activeImg.mimeType};base64,${activeImg.dataBase64}`}
              alt="Prescription fullscreen"
              className="max-h-[82vh] max-w-full object-contain rounded-lg border border-white/20 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </AppShell>
  );
}
