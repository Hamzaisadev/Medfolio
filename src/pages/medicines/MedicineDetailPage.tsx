import { useState, useEffect, useCallback } from 'react';
import { MessageCircle, ShoppingBag } from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppShell } from '../../components/layout/AppShell';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Field } from '../../components/ui/Field';
import { Select } from '../../components/ui/Select';
import { Textarea } from '../../components/ui/Textarea';
import { Dialog } from '../../components/ui/Dialog';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Toast } from '../../components/ui/Toast';
import { Skeleton } from '../../components/ui/Skeleton';
import { ErrorState } from '../../components/ui/ErrorState';
import { Disclaimer } from '../../components/ui/Disclaimer';
import { MedicineIcon } from '../../components/ui/icons';
import { MedicineOrderModal } from '../../components/medicines/MedicineOrderModal';
import { useAuth } from '../../lib/auth/AuthContext';
import { medicinesRepo, dosesRepo, sideEffectsRepo, visitsRepo } from '../../lib/db';
import { readInventory } from '../../lib/inventory';
import { explainMedicine } from '../../lib/ai/client';
import { formatMinutesTo24h, todayInAppTz } from '../../lib/time';
import { frequencyDescription, defaultDoseTimes } from '../../domain/frequency';
import { MEDICINE_INFO_DISCLAIMER } from '../../lib/disclaimer';
import type { Tables } from '../../lib/supabase/types';

export function MedicineDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  const [medicine, setMedicine] = useState<Tables<'medicines'> | null>(null);
  const [visit, setVisit] = useState<Tables<'visits'> | null>(null);
  const [sideEffects, setSideEffects] = useState<Tables<'side_effects'>[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Plain-Language Explainer state
  const [explainer, setExplainer] = useState<{
    summary: string;
    purpose: string;
    common_instructions: string;
  } | null>(null);
  const [isLoadingExplainer, setIsLoadingExplainer] = useState(false);

  // Side Effect Modal
  const [isSideEffectModalOpen, setIsSideEffectModalOpen] = useState(false);
  const [symptomText, setSymptomText] = useState('');
  const [severity, setSeverity] = useState<'mild' | 'moderate' | 'severe'>('mild');
  const [isSavingSymptom, setIsSavingSymptom] = useState(false);

  // Discontinue Dialog
  const [isDiscontinueOpen, setIsDiscontinueOpen] = useState(false);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [inventoryCount, setInventoryCount] = useState<number>(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const effectiveUserId = user?.id || profile?.user_id || '';
  const effectiveProfileId = profile?.id || effectiveUserId;

  const loadData = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const med = await medicinesRepo.getMedicineById(id);
      if (!med) {
        navigate('/medicines/cabinet');
        return;
      }
      setMedicine(med);
      const inv = readInventory(effectiveProfileId);
      setInventoryCount(inv[med.id] ?? 0);

      // Load linked visit if any
      if (med.visit_id) {
        const v = await visitsRepo.getVisitById(med.visit_id);
        setVisit(v);
      }

      // Load side effects logged for this user/medicine
      const seList = await sideEffectsRepo.listSideEffects(effectiveProfileId);
      setSideEffects(seList.filter((s) => s.medicine_id === id));

      // Fetch or read cached plain language explainer
      setIsLoadingExplainer(true);
      try {
        const info = await explainMedicine({ medicine_name: med.medicine_name });
        setExplainer(info);
      } catch (err) {
        console.error('Failed to fetch explainer:', err);
      } finally {
        setIsLoadingExplainer(false);
      }
    } catch (err) {
      console.error('Failed to load medicine details:', err);
      // Without this, a failed fetch spun the skeleton forever.
      setLoadError('This medicine could not be loaded. Check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  }, [id, navigate, effectiveProfileId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSaveSideEffect = async () => {
    if (!medicine || !symptomText.trim()) return;
    setIsSavingSymptom(true);
    try {
      await sideEffectsRepo.createSideEffect({
        user_id: effectiveUserId,
        profile_id: profile?.id || effectiveUserId,
        medicine_id: medicine.id,
        medicine_name: medicine.medicine_name,
        note: symptomText.trim(),
        severity,
        occurred_at: new Date().toISOString(),
      });
      setToastMessage('Symptom / Side effect logged.');
      setSymptomText('');
      setIsSideEffectModalOpen(false);
      const updated = await sideEffectsRepo.listSideEffects(effectiveProfileId);
      setSideEffects(updated.filter((s) => s.medicine_id === medicine.id));
    } catch (err) {
      console.error('Failed to log side effect:', err);
      setToastMessage('Failed to save side effect entry.');
    } finally {
      setIsSavingSymptom(false);
    }
  };

  const handleDiscontinue = async () => {
    if (!medicine) return;
    try {
      const today = todayInAppTz();
      await medicinesRepo.discontinueMedicine(medicine.id, today);
      await dosesRepo.deleteFuturePendingDoses(medicine.id, today);
      setToastMessage('Medicine discontinued. Future scheduled doses cleared.');
      setIsDiscontinueOpen(false);
      await loadData();
    } catch (err) {
      console.error('Failed to discontinue:', err);
      setToastMessage('Failed to discontinue medicine.');
    }
  };

  if (isLoading) {
    return (
      <AppShell>
        <div className="space-y-6">
          <Skeleton className="h-10 w-1/3" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </AppShell>
    );
  }

  if (loadError || !medicine) {
    return (
      <AppShell>
        <ErrorState
          title="Medicine didn't load"
          message={loadError ?? 'This record could not be found. It may have been removed.'}
          onRetry={loadData}
          fallbackAction={
            <Button variant="secondary" onClick={() => navigate('/medicines/cabinet')}>
              Back to cabinet
            </Button>
          }
        />
      </AppShell>
    );
  }

  const isDiscontinued = Boolean(medicine.discontinued_at);
  const freqDesc = frequencyDescription(medicine.frequency_code);
  const doseTimes = defaultDoseTimes(medicine.frequency_code, medicine.with_food, medicine.frequency_raw);

  return (
    <AppShell>
      <PageHeader
        title={medicine.medicine_name}
        description={`${medicine.strength || ''} ${medicine.form || ''} • ${freqDesc}`}
        action={
          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsSideEffectModalOpen(true)}
            >
              Log Side Effect
            </Button>
            {!isDiscontinued && (
              <Button
                variant="danger"
                size="sm"
                onClick={() => setIsDiscontinueOpen(true)}
              >
                Discontinue Course
              </Button>
            )}
          </div>
        }
      />

      <Toast
        open={Boolean(toastMessage)}
        onClose={() => setToastMessage(null)}
        message={toastMessage || ''}
        tone="ok"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2/3): Dosage, Instructions & Plain Language Explainer */}
        <div className="lg:col-span-2 space-y-6">
          {/* Active Status Card */}
          <Card>
            <div className="flex items-center justify-between p-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-accent-subtle text-accent flex items-center justify-center">
                  <MedicineIcon size={22} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-lg text-content">{medicine.medicine_name}</span>
                    {isDiscontinued ? (
                      <Badge tone="risk">Discontinued</Badge>
                    ) : (
                      <Badge tone="ok">Active Course</Badge>
                    )}
                    {medicine.is_ongoing && <Badge tone="info">Ongoing</Badge>}
                  </div>
                  <p className="text-xs text-content-subtle mt-0.5">
                    Start Date: {medicine.start_date}
                    {medicine.end_date ? ` • End Date: ${medicine.end_date}` : ''}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5 pt-4 border-t border-line text-xs">
              <div>
                <span className="text-content-subtle block">Dose Amount</span>
                <span className="font-bold text-content text-sm mt-0.5 block">{medicine.dose_amount || '1 tablet'}</span>
              </div>
              <div>
                <span className="text-content-subtle block">Frequency</span>
                <span className="font-bold text-content text-sm mt-0.5 block">{medicine.frequency_code || medicine.frequency_raw || 'OD'}</span>
              </div>
              <div>
                <span className="text-content-subtle block">Meal Relation</span>
                <span className="font-bold text-content text-sm mt-0.5 block">
                  {medicine.with_food ? 'With / After Food' : 'Empty Stomach'}
                </span>
              </div>
              <div>
                <span className="text-content-subtle block">Duration</span>
                <span className="font-bold text-content text-sm mt-0.5 block">
                  {medicine.is_ongoing ? 'Ongoing' : medicine.duration_days ? `${medicine.duration_days} days` : 'As directed'}
                </span>
              </div>
            </div>

            {/* Dose Times Bar */}
            {doseTimes.length > 0 && (
              <div className="mt-4 pt-3 border-t border-line flex items-center gap-2 text-xs">
                <span className="text-content-subtle font-semibold">Scheduled Dose Times:</span>
                <div className="flex flex-wrap gap-1.5">
                  {doseTimes.map((mins, idx) => (
                    <span key={idx} className="px-2 py-0.5 rounded bg-accent-subtle border border-line font-bold text-accent">
                      {formatMinutesTo24h(mins)}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {medicine.instructions && (
              <div className="mt-4 pt-3 border-t border-line text-xs text-content-muted">
                <span className="font-semibold text-content">Doctor's Special Instructions: </span>
                <span>{medicine.instructions}</span>
              </div>
            )}
          </Card>

          {/* Plain-Language Medication Guide */}
          <Card header={<h2 className="text-base font-bold text-content">Medication Overview & Purpose</h2>}>
            {isLoadingExplainer ? (
              <div className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-5/6" />
              </div>
            ) : explainer ? (
              <div className="space-y-4 text-xs text-content-muted leading-relaxed">
                <div>
                  <h3 className="font-bold text-content text-sm mb-1">What this medicine does</h3>
                  <p>{explainer.summary}</p>
                </div>

                <div>
                  <h3 className="font-bold text-content text-sm mb-1">Common Medical Purpose</h3>
                  <p>{explainer.purpose}</p>
                </div>

                <div>
                  <h3 className="font-bold text-content text-sm mb-1">Key Usage Tips</h3>
                  <p>{explainer.common_instructions}</p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-content-subtle">
                No plain-language summary available for this specific formulation. Always follow your doctor's instructions.
              </p>
            )}

            <div className="mt-5 pt-3 border-t border-line">
              <Disclaimer text={MEDICINE_INFO_DISCLAIMER} />
            </div>
          </Card>

          {/* Side Effects Log Section */}
          <Card
            header={
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-content">Logged Symptoms & Side Effects ({sideEffects.length})</h2>
                  <p className="text-xs text-content-subtle">Keep track of any adverse reactions to share with your physician.</p>
                </div>
                <Button variant="secondary" size="sm" onClick={() => setIsSideEffectModalOpen(true)}>
                  + Log Symptom
                </Button>
              </div>
            }
          >
            {sideEffects.length === 0 ? (
              <p className="text-xs text-content-subtle py-4 text-center">
                No side effects or adverse reactions logged for this medicine.
              </p>
            ) : (
              <div className="space-y-3">
                {sideEffects.map((se) => (
                  <div key={se.id} className="p-3 rounded-md border border-line bg-surface-sunken/50 flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-content">{se.note}</span>
                        <Badge
                          tone={se.severity === 'severe' ? 'risk' : se.severity === 'moderate' ? 'warn' : 'neutral'}
                          size="sm"
                        >
                          {se.severity}
                        </Badge>
                      </div>
                      <span className="text-2xs text-content-subtle mt-1 block">
                        Logged on {se.occurred_at ? se.occurred_at.split('T')[0] : se.created_at.split('T')[0]}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Right Column (1/3): Cabinet & Linked Doctor Consultation Context */}
        <div className="space-y-6">
          {/* Cabinet & WhatsApp Order Action Card */}
          <Card header={<h2 className="text-base font-bold text-content">Cabinet Stock & Pharmacy</h2>}>
            <div className="space-y-3.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-content-subtle font-semibold">Current In Cabinet</span>
                {inventoryCount <= 0 ? (
                  <Badge tone="risk" size="sm" withIcon>
                    0 in stock (Needs Purchase)
                  </Badge>
                ) : inventoryCount <= 5 ? (
                  <Badge tone="warn" size="sm" withIcon>
                    Low Stock: {inventoryCount} left
                  </Badge>
                ) : (
                  <Badge tone="ok" size="sm" withIcon>
                    {inventoryCount} tablets
                  </Badge>
                )}
              </div>

              <div className="pt-2 border-t border-line space-y-2">
                <Button
                  variant="primary"
                  fullWidth
                  size="sm"
                  onClick={() => setIsOrderModalOpen(true)}
                  leftIcon={<MessageCircle size={15} />}
                  className="bg-emerald-600 hover:bg-emerald-700 border-emerald-600 text-white font-bold text-xs tap-spring"
                >
                  Order / Refill via WhatsApp
                </Button>
                <Button
                  variant="secondary"
                  fullWidth
                  size="sm"
                  onClick={() => setIsOrderModalOpen(true)}
                  leftIcon={<ShoppingBag size={14} />}
                  className="text-xs font-semibold"
                >
                  Record In-Store Purchase
                </Button>
              </div>
            </div>
          </Card>

          <Card header={<h2 className="text-base font-bold text-content">Prescribing Doctor Visit</h2>}>
            {visit ? (
              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-content-subtle block">Doctor</span>
                  <span className="font-bold text-content text-sm">{visit.doctor_name || 'Doctor'}</span>
                </div>
                {visit.clinic_name && (
                  <div>
                    <span className="text-content-subtle block">Clinic / Hospital</span>
                    <span className="font-semibold text-content">{visit.clinic_name}</span>
                  </div>
                )}
                <div>
                  <span className="text-content-subtle block">Consultation Date</span>
                  <span className="font-semibold text-content">{visit.visit_date}</span>
                </div>
                {visit.diagnosis && (
                  <div>
                    <span className="text-content-subtle block">Diagnosis</span>
                    <span className="font-semibold text-content">{visit.diagnosis}</span>
                  </div>
                )}
                {visit.doctor_advice && (
                  <div>
                    <span className="text-content-subtle block">Doctor's Advice</span>
                    <p className="text-content-muted mt-0.5">{visit.doctor_advice}</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-content-subtle">
                This medicine was self-logged or has no linked doctor visit record.
              </p>
            )}
          </Card>
        </div>
      </div>

      {/* Log Side Effect Modal */}
      <Dialog
        open={isSideEffectModalOpen}
        onOpenChange={setIsSideEffectModalOpen}
        title={`Log Side Effect for ${medicine.medicine_name}`}
        description="Describe any symptoms or bodily changes experienced while taking this medication."
      >
        <div className="space-y-4">
          <Field id="se-desc" label="Symptom Description" required>
            <Textarea
              value={symptomText}
              onChange={(e) => setSymptomText(e.target.value)}
              placeholder="e.g. Mild stomach ache 30 minutes after dose, dry cough, dizziness"
              rows={3}
            />
          </Field>

          <Field id="se-sev" label="Severity">
            <Select
              id="se-sev"
              value={severity}
              onValueChange={(val) => setSeverity(val as 'mild' | 'moderate' | 'severe')}
              options={[
                { value: 'mild', label: 'Mild — Slight discomfort, manageable' },
                { value: 'moderate', label: 'Moderate — Noticeable impairment or discomfort' },
                { value: 'severe', label: 'Severe — Significant adverse reaction' },
              ]}
            />
          </Field>

          <div className="flex items-center justify-end gap-3 pt-3">
            <Button variant="ghost" onClick={() => setIsSideEffectModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSaveSideEffect}
              loading={isSavingSymptom}
              disabled={!symptomText.trim()}
            >
              Save Log
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Medicine Order / WhatsApp Refill Modal */}
      <MedicineOrderModal
        isOpen={isOrderModalOpen}
        onClose={() => setIsOrderModalOpen(false)}
        medicine={medicine}
        profileId={effectiveProfileId}
        onStockUpdated={(newStock) => {
          setInventoryCount(newStock);
          setToastMessage(`Cabinet updated: ${newStock} tablets in stock.`);
        }}
      />

      {/* Discontinue Confirmation Dialog */}
      <ConfirmDialog
        open={isDiscontinueOpen}
        onOpenChange={setIsDiscontinueOpen}
        title="Discontinue Medicine Course"
        description={`Are you sure you want to stop taking "${medicine.medicine_name}"? This removes all future scheduled doses from your calendar while preserving your past dose history.`}
        requiredPhrase="STOP"
        tone="danger"
        confirmLabel="Discontinue Course"
        onConfirm={handleDiscontinue}
      />
    </AppShell>
  );
}
