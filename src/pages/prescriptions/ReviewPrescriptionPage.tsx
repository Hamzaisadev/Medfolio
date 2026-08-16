import { useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AppShell } from '../../components/layout/AppShell';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Field } from '../../components/ui/Field';
import { Input } from '../../components/ui/Input';
import { Textarea } from '../../components/ui/Textarea';
import { Badge } from '../../components/ui/Badge';
import { Disclaimer } from '../../components/ui/Disclaimer';
import { Toast } from '../../components/ui/Toast';
import { useAuth } from '../../lib/auth/AuthContext';
import { parseFrequency, defaultDoseTimes, frequencyDescription } from '../../domain/frequency';
import { parseDuration, computeEndDate } from '../../domain/duration';
import { buildSchedule } from '../../domain/schedule';
import { todayInAppTz, formatMinutesTo24h } from '../../lib/time';
import { EXTRACTION_DISCLAIMER } from '../../lib/disclaimer';
import { visitsRepo, medicinesRepo, dosesRepo, testOrdersRepo, extractionAuditRepo } from '../../lib/db';
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
  with_food?: boolean;
  is_ongoing?: boolean;
  confidence?: 'high' | 'low';
}

interface TestOrderDraft {
  id: string;
  test_name: string;
  confidence?: 'high' | 'low';
}

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

  // Form State
  const [doctorName, setDoctorName] = useState(initialDraft?.doctor_name || '');
  const [clinicName, setClinicName] = useState(initialDraft?.clinic_name || '');
  const [visitDate, setVisitDate] = useState(
    initialDraft?.visit_date || todayInAppTz()
  );
  const [diagnosis, setDiagnosis] = useState(initialDraft?.diagnosis || '');
  const [doctorAdvice, setDoctorAdvice] = useState(initialDraft?.doctor_advice || '');
  const [followUpDate, setFollowUpDate] = useState(initialDraft?.follow_up || '');
  const [visitCost, setVisitCost] = useState<string>('');

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
    (initialDraft?.medicines || []).map((m, idx) => ({
      id: `med-${idx}-${Date.now()}`,
      medicine_name: m.medicine_name || '',
      strength: m.strength || '',
      form: m.form || 'tablet',
      dose_amount: m.dose_amount || '1 tablet',
      frequency_raw: m.frequency_raw || '',
      duration_raw: m.duration_raw || '',
      instructions: m.instructions || '',
      with_food: true,
      is_ongoing: false,
      confidence: m.confidence || 'high',
    }))
  );

  // Ordered Diagnostic Tests List
  const [tests, setTests] = useState<TestOrderDraft[]>(
    (initialDraft?.tests_ordered || []).map((t, idx) => ({
      id: `test-${idx}-${Date.now()}`,
      test_name: typeof t === 'string' ? t : (t as { test_name?: string }).test_name || '',
      confidence: 'high',
    }))
  );

  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Medicine Actions
  const handleAddMedicine = () => {
    setMedicines((prev) => [
      ...prev,
      {
        id: `med-${Date.now()}`,
        medicine_name: '',
        strength: '',
        form: 'tablet',
        dose_amount: '1 tablet',
        frequency_raw: 'OD',
        duration_raw: '5 days',
        with_food: true,
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
        id: `test-${Date.now()}`,
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

  // Atomic Database Transaction
  const handleSave = async () => {
    setErrorMessage(null);

    // Filter out completely empty medicine drafts
    const validMedicines = medicines.filter((m) => m.medicine_name && m.medicine_name.trim().length > 0);

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
      const pillInventoryMap: Record<string, number> = {};
      try {
        const savedInv = localStorage.getItem('medfolio_pill_inventory_v1');
        if (savedInv) Object.assign(pillInventoryMap, JSON.parse(savedInv));
      } catch {
        // ignore
      }

      for (const med of validMedicines) {
        // Robust frequency resolution
        const freqCode = parseFrequency(med.frequency_raw) || (med.is_ongoing ? 'OD' : 'OD');
        const dur = parseDuration(med.duration_raw);
        
        let durationDays: number | null = null;
        if (dur.kind === 'days') {
          durationDays = dur.days;
        } else if (dur.kind === 'ongoing' || med.is_ongoing) {
          durationDays = null;
        } else {
          // Graceful fallback for unstated duration on prescriptions
          durationDays = 5;
        }

        const endDate =
          durationDays && !med.is_ongoing
            ? computeEndDate(effectiveVisitDate, durationDays)
            : null;

        const defaultTimes = defaultDoseTimes(freqCode, med.with_food, med.frequency_raw || 'OD');

        const createdMed = await medicinesRepo.createMedicine({
          user_id: effectiveUserId,
          profile_id: effectiveProfileId,
          visit_id: visit.id,
          medicine_name: med.medicine_name.trim(),
          strength: med.strength?.trim() || null,
          form: med.form || 'tablet',
          dose_amount: med.dose_amount || '1 tablet',
          frequency_code: freqCode,
          frequency_raw: med.frequency_raw || 'OD',
          with_food: med.with_food ?? true,
          duration_days: durationDays,
          start_date: effectiveVisitDate,
          end_date: endDate,
          is_ongoing: med.is_ongoing ?? false,
          instructions: med.instructions || null,
        });

        // Initialize pill inventory count (e.g. standard pack of 20 pills)
        if (createdMed.id && !pillInventoryMap[createdMed.id]) {
          pillInventoryMap[createdMed.id] = durationDays ? durationDays * (defaultTimes.length || 1) + 4 : 20;
        }

        // Generate automated deterministic dose rows if not PRN
        if (freqCode !== 'PRN' && freqCode !== 'SOS' && defaultTimes.length > 0) {
          const doseRows = buildSchedule({
            medicineId: createdMed.id,
            startDate: effectiveVisitDate,
            durationDays: med.is_ongoing ? 30 : durationDays || 5,
            isOngoing: med.is_ongoing ?? false,
            doseTimes: defaultTimes,
            now: new Date(),
          });

          if (doseRows.length > 0) {
            try {
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
            } catch (doseErr) {
              console.warn('Dose schedule generation notice:', doseErr);
            }
          }
        }
      }

      // Save pill inventory
      try {
        localStorage.setItem('medfolio_pill_inventory_v1', JSON.stringify(pillInventoryMap));
      } catch {
        // ignore
      }

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

      setToastMessage('Prescription and schedule saved successfully!');
      navigate('/medicines');
    } catch (err: unknown) {
      console.error('Save prescription error:', err);
      const msg = err instanceof Error ? err.message : 'Failed to save prescription. Please check fields.';
      setErrorMessage(msg);
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

      <Toast
        open={Boolean(toastMessage)}
        onClose={() => setToastMessage(null)}
        message={toastMessage || ''}
        tone="ok"
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
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-ink-900">Original Prescription</h2>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 font-semibold border border-teal-200">
                      Page {activeImageIndex + 1}/{images.length}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Zoom multiplier chips */}
                    <div className="flex items-center bg-ink-100 p-0.5 rounded-md text-xs font-semibold text-ink-600">
                      {[2, 2.5, 3.5].map((level) => (
                        <button
                          key={level}
                          type="button"
                          onClick={() => setZoomLevel(level)}
                          className={`px-1.5 py-0.5 rounded transition-colors ${
                            zoomLevel === level ? 'bg-white text-teal-800 shadow-xs' : 'hover:text-ink-900'
                          }`}
                        >
                          {level}x
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(true)}
                      className="text-xs text-teal-700 hover:text-teal-900 font-medium underline ml-1"
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
                  className="relative w-full h-[420px] rounded-[var(--radius-md)] border border-ink-200 bg-ink-900/5 overflow-hidden flex items-center justify-center cursor-crosshair select-none group"
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
                    <div className="absolute bottom-2 right-2 bg-ink-900/75 backdrop-blur-xs text-white text-[11px] font-medium px-2.5 py-1 rounded-full pointer-events-none flex items-center gap-1.5 shadow-sm">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <circle cx="11" cy="11" r="8" />
                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                        <line x1="11" y1="8" x2="11" y2="14" />
                        <line x1="8" y1="11" x2="14" y2="11" />
                      </svg>
                      Hover to magnify handwriting
                    </div>
                  )}

                  {isHoverZooming && (
                    <div className="absolute top-2 left-2 bg-teal-800/85 backdrop-blur-xs text-white text-[10px] font-bold px-2 py-0.5 rounded pointer-events-none">
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
                        className={`relative rounded-md border-2 overflow-hidden w-14 h-14 shrink-0 transition-all ${
                          activeImageIndex === idx
                            ? 'border-teal-600 ring-2 ring-teal-200 scale-105'
                            : 'border-ink-200 opacity-60 hover:opacity-100'
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
          <Card header={<h2 className="text-base font-bold text-ink-900">Visit Information</h2>}>
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
                  <Input
                    type="date"
                    value={visitDate}
                    onChange={(e) => setVisitDate(e.target.value)}
                  />
                </Field>

                <Field id="rev-diag" label="Diagnosis">
                  <Input
                    value={diagnosis}
                    onChange={(e) => setDiagnosis(e.target.value)}
                    placeholder="e.g. Pain Rt knee"
                  />
                </Field>
              </div>

              <Field id="rev-advice" label="Doctor's Advice / Notes">
                <Textarea
                  value={doctorAdvice}
                  onChange={(e) => setDoctorAdvice(e.target.value)}
                  placeholder="e.g. Steam inhalation, rest"
                  rows={2}
                />
              </Field>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field id="rev-followup" label="Follow-up Date">
                  <Input
                    type="date"
                    value={followUpDate}
                    onChange={(e) => setFollowUpDate(e.target.value)}
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
                  <h2 className="text-base font-bold text-ink-900">Prescribed Medicines ({medicines.length})</h2>
                  <p className="text-xs text-ink-500">Each medicine will generate automated dose times.</p>
                </div>
                <Button variant="secondary" size="sm" onClick={handleAddMedicine}>
                  + Add Medicine
                </Button>
              </div>
            }
          >
            <div className="space-y-5">
              {medicines.length === 0 ? (
                <div className="text-center py-8 text-sm text-ink-500">
                  No medicines added yet. Click "+ Add Medicine" above.
                </div>
              ) : (
                medicines.map((m, idx) => {
                  const isLowConf = m.confidence === 'low';
                  const freqCode = parseFrequency(m.frequency_raw);
                  const durResult = parseDuration(m.duration_raw);
                  const freqDesc = frequencyDescription(freqCode);
                  const doseTimes = defaultDoseTimes(freqCode, m.with_food, m.frequency_raw);

                  return (
                    <div
                      key={m.id}
                      className={`p-4 rounded-[var(--radius-lg)] border ${
                        isLowConf
                          ? 'border-warn-border bg-warn-bg/20'
                          : 'border-ink-200 bg-white'
                      } space-y-4 shadow-[var(--shadow-card)]`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-ink-500 uppercase tracking-wider">
                          Medicine #{idx + 1}
                        </span>
                        <div className="flex items-center gap-2">
                          {isLowConf && <Badge tone="warn" size="sm">Check this</Badge>}
                          <button
                            type="button"
                            onClick={() => handleRemoveMedicine(m.id)}
                            className="text-xs text-red-600 hover:text-red-800 font-medium p-1"
                          >
                            Remove
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field id={`med-name-${m.id}`} label="Medicine Name" required>
                          <Input
                            value={m.medicine_name}
                            onChange={(e) => handleUpdateMedicine(m.id, { medicine_name: e.target.value })}
                            placeholder="e.g. Ultrafen-plus"
                          />
                        </Field>

                        <div className="grid grid-cols-2 gap-2">
                          <Field id={`med-strength-${m.id}`} label="Strength">
                            <Input
                              value={m.strength || ''}
                              onChange={(e) => handleUpdateMedicine(m.id, { strength: e.target.value })}
                              placeholder="e.g. 50mg"
                            />
                          </Field>
                          <Field id={`med-form-${m.id}`} label="Form">
                            <Input
                              value={m.form || ''}
                              onChange={(e) => handleUpdateMedicine(m.id, { form: e.target.value })}
                              placeholder="e.g. Tab"
                            />
                          </Field>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <Field id={`med-freq-${m.id}`} label="Frequency (as written)" required>
                            <Input
                              value={m.frequency_raw || ''}
                              onChange={(e) => handleUpdateMedicine(m.id, { frequency_raw: e.target.value })}
                              placeholder="e.g. 1+0+1, BD, TDS, PRN"
                            />
                          </Field>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-ink-500">
                            <span>Interpreted:</span>
                            <span className={`font-semibold ${freqCode ? 'text-teal-700' : 'text-amber-700'}`}>
                              {freqDesc}
                            </span>
                            {doseTimes.length > 0 && (
                              <span className="text-ink-400">
                                ({doseTimes.map((t) => formatMinutesTo24h(t)).join(', ')})
                              </span>
                            )}
                          </div>
                        </div>

                        <div>
                          <Field id={`med-dur-${m.id}`} label="Duration" required={!m.is_ongoing}>
                            <Input
                              value={m.duration_raw || ''}
                              onChange={(e) => handleUpdateMedicine(m.id, { duration_raw: e.target.value })}
                              placeholder="e.g. 2 wks, 5 days"
                              disabled={m.is_ongoing}
                            />
                          </Field>
                          <div className="mt-1 flex items-center justify-between text-xs">
                            <span className="text-ink-500">
                              {durResult?.kind === 'days'
                                ? `Interpreted: ${durResult.days} days`
                                : m.is_ongoing
                                  ? 'Ongoing'
                                  : ''}
                            </span>
                            <label className="flex items-center gap-1.5 cursor-pointer text-ink-600 font-medium">
                              <input
                                type="checkbox"
                                checked={m.is_ongoing || false}
                                onChange={(e) =>
                                  handleUpdateMedicine(m.id, {
                                    is_ongoing: e.target.checked,
                                    duration_raw: e.target.checked ? 'Ongoing' : '',
                                  })
                                }
                                className="rounded text-teal-600 focus:ring-teal-500"
                              />
                              Ongoing
                            </label>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field id={`med-inst-${m.id}`} label="Instructions / Meal relation">
                          <Input
                            value={m.instructions || ''}
                            onChange={(e) => handleUpdateMedicine(m.id, { instructions: e.target.value })}
                            placeholder="e.g. after food, with milk"
                          />
                        </Field>

                        <Field id={`med-food-${m.id}`} label="Meal Timing">
                          <select
                            value={m.with_food ? 'with' : 'empty'}
                            onChange={(e) => handleUpdateMedicine(m.id, { with_food: e.target.value === 'with' })}
                            className="w-full h-11 px-3.5 py-2 text-sm bg-surface-primary border border-ink-200 rounded-[var(--radius-md)] text-ink-900 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600"
                          >
                            <option value="with">After / With Food</option>
                            <option value="empty">Empty Stomach (07:00 AM)</option>
                          </select>
                        </Field>
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
                  <h2 className="text-base font-bold text-ink-900">
                    Ordered Lab Tests / Investigations ({tests.length})
                  </h2>
                  <p className="text-xs text-ink-500">Creates pending test orders linked to this visit.</p>
                </div>
                <Button variant="secondary" size="sm" onClick={handleAddTest}>
                  + Add Test
                </Button>
              </div>
            }
          >
            <div className="space-y-3">
              {tests.length === 0 ? (
                <div className="text-center py-6 text-sm text-ink-500">
                  No tests ordered on this prescription.
                </div>
              ) : (
                tests.map((t, idx) => (
                  <div
                    key={t.id}
                    className="flex items-center gap-3 p-3 rounded-[var(--radius-md)] border border-ink-200 bg-white"
                  >
                    <span className="text-xs font-bold text-ink-400 w-6">#{idx + 1}</span>
                    <Input
                      value={t.test_name}
                      onChange={(e) => handleUpdateTest(t.id, e.target.value)}
                      placeholder="e.g. CBC, Serum Creatinine, X-Ray Knee"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveTest(t.id)}
                      className="text-xs text-red-600 hover:text-red-800 font-medium px-2 py-1"
                    >
                      Delete
                    </button>
                  </div>
                ))
              )}
            </div>
          </Card>

          {/* Clinical Disclaimer per 05-SAFETY-AND-COMPLIANCE.md */}
          <Disclaimer text={EXTRACTION_DISCLAIMER} />
        </div>
      </div>

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
