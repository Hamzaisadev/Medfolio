import { useState, useEffect, useRef, useCallback } from 'react';
import { Dialog } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { SegmentedControl } from '../ui/SegmentedControl';
import { RollerNumberInput } from '../ui/RollerNumberInput';
import { ErrorState } from '../ui/ErrorState';
import { DropletIcon, HeartPulseIcon } from '../ui/icons';
import { VITAL_TONE } from '../ui/vitalTone';
import {
  evaluateGlucose,
  evaluateBloodPressure,
  mmolToMgDl,
  type GlucoseType,
  type GlucoseReading,
  type BloodPressureReading,
} from '../../domain/vitals';
import { createGlucoseReading, createBloodPressureReading } from '../../lib/db/vitals';
import { useAuth } from '../../lib/auth/AuthContext';

export interface QuickVitalsModalProps {
  open: boolean;
  onClose: () => void;
  initialType?: 'glucose' | 'bp';
  onSaved?: () => void;
}

export function QuickVitalsModal({
  open,
  onClose,
  initialType = 'glucose',
  onSaved,
}: QuickVitalsModalProps) {
  const { user, profile } = useAuth();
  const effectiveUserId = user?.id || profile?.user_id || '';
  const effectiveProfileId = profile?.id || effectiveUserId;

  const [activeType, setActiveType] = useState<'glucose' | 'bp'>(initialType);

  // Glucose state
  const [glucoseType, setGlucoseType] = useState<GlucoseType>('fasting');
  const [glucoseValue, setGlucoseValue] = useState<number>(100);
  const [glucoseUnit, setGlucoseUnit] = useState<'mg/dL' | 'mmol/L'>('mg/dL');
  const [glucoseNotes, setGlucoseNotes] = useState('');
  const [glucoseSaveError, setGlucoseSaveError] = useState<string | null>(null);
  const glucoseInputRef = useRef<HTMLInputElement>(null);

  // BP state
  const [systolic, setSystolic] = useState<number>(120);
  const [diastolic, setDiastolic] = useState<number>(80);
  const [pulse, setPulse] = useState<number>(72);
  const [bpArm, setBpArm] = useState<'left' | 'right'>('left');
  const [bpPosture, setBpPosture] = useState<'sitting' | 'standing' | 'lying'>('sitting');
  const [bpNotes, setBpNotes] = useState('');
  const [bpSaveError, setBpSaveError] = useState<string | null>(null);
  const systolicInputRef = useRef<HTMLInputElement>(null);

  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setActiveType(initialType);
      setGlucoseSaveError(null);
      setBpSaveError(null);
      const timer = setTimeout(() => {
        if (initialType === 'glucose') {
          glucoseInputRef.current?.focus();
          glucoseInputRef.current?.select();
        } else {
          systolicInputRef.current?.focus();
          systolicInputRef.current?.select();
        }
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [open, initialType]);

  const handleSaveGlucose = useCallback(
    async (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      if (!glucoseValue || !effectiveUserId || !effectiveProfileId || isSaving) return;

      let mgDl = glucoseValue;
      if (glucoseUnit === 'mmol/L') {
        mgDl = mmolToMgDl(mgDl);
      }

      const newReading: GlucoseReading = {
        user_id: effectiveUserId,
        profile_id: effectiveProfileId,
        measured_at: new Date().toISOString(),
        type: glucoseType,
        value_mg_dl: Math.round(mgDl),
        notes: glucoseNotes.trim() || undefined,
      };

      setIsSaving(true);
      setGlucoseSaveError(null);
      try {
        await createGlucoseReading(newReading);
        setGlucoseNotes('');
        onSaved?.();
        onClose();
      } catch (err) {
        console.error('Failed to save glucose reading:', err);
        setGlucoseSaveError('Could not save reading. Check your connection.');
      } finally {
        setIsSaving(false);
      }
    },
    [
      glucoseValue,
      effectiveUserId,
      effectiveProfileId,
      isSaving,
      glucoseUnit,
      glucoseType,
      glucoseNotes,
      onSaved,
      onClose,
    ]
  );

  const handleSaveBp = useCallback(
    async (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      if (!systolic || !diastolic || !effectiveUserId || !effectiveProfileId || isSaving) return;

      const newReading: BloodPressureReading = {
        user_id: effectiveUserId,
        profile_id: effectiveProfileId,
        measured_at: new Date().toISOString(),
        systolic: Math.round(systolic),
        diastolic: Math.round(diastolic),
        pulse_bpm: pulse ? Math.round(pulse) : undefined,
        arm: bpArm,
        posture: bpPosture,
        notes: bpNotes.trim() || undefined,
      };

      setIsSaving(true);
      setBpSaveError(null);
      try {
        await createBloodPressureReading(newReading);
        setBpNotes('');
        onSaved?.();
        onClose();
      } catch (err) {
        console.error('Failed to save blood pressure reading:', err);
        setBpSaveError('Could not save BP log. Check your connection.');
      } finally {
        setIsSaving(false);
      }
    },
    [
      systolic,
      diastolic,
      effectiveUserId,
      effectiveProfileId,
      isSaving,
      pulse,
      bpArm,
      bpPosture,
      bpNotes,
      onSaved,
      onClose,
    ]
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => !isOpen && onClose()}
      title={activeType === 'glucose' ? 'Log Blood Glucose' : 'Log Blood Pressure'}
      description="Quickly record your latest vital reading with live clinical evaluation."
      className="max-w-lg"
    >
      <div className="space-y-4">
        {/* Toggle Vitals Mode */}
        <SegmentedControl
          value={activeType}
          onChange={(val) => setActiveType(val as 'glucose' | 'bp')}
          options={[
            {
              value: 'glucose',
              label: (
                <span className="flex items-center gap-1.5 font-bold">
                  <DropletIcon size={14} className="text-amber-500" /> Blood Sugar
                </span>
              ),
            },
            {
              value: 'bp',
              label: (
                <span className="flex items-center gap-1.5 font-bold">
                  <HeartPulseIcon size={14} className="text-rose-500" /> Blood Pressure
                </span>
              ),
            },
          ]}
          fullWidth
        />

        {activeType === 'glucose' ? (
          <form onSubmit={handleSaveGlucose} className="space-y-4">
            {glucoseSaveError && <ErrorState compact message={glucoseSaveError} />}

            {/* Meal context pills */}
            <div className="space-y-1.5">
              <span className="block text-2xs uppercase tracking-wider font-bold text-content-subtle">
                Measurement Context
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {(
                  [
                    { id: 'fasting', label: 'Fasting' },
                    { id: 'post_prandial', label: 'Post-Meal' },
                    { id: 'random', label: 'Random' },
                    { id: 'bedtime', label: 'Bedtime' },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setGlucoseType(t.id)}
                    className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                      glucoseType === t.id
                        ? 'bg-accent text-content-onaccent border-accent shadow-2xs'
                        : 'bg-surface-sunken text-content-muted border-line hover:border-line-strong'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Value Entry and Live ADA Classification */}
            {(() => {
              const mgDlVal =
                glucoseUnit === 'mmol/L' ? mmolToMgDl(glucoseValue) : glucoseValue;
              const gEval = evaluateGlucose(mgDlVal, glucoseType);
              return (
                <div className="p-4 rounded-2xl bg-surface-sunken/40 border border-line space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap pb-2 border-b border-line/60">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-content-muted">Target Status:</span>
                      <Badge tone={VITAL_TONE[gEval.tone].badge} size="sm" withIcon>
                        {gEval.label}
                      </Badge>
                    </div>
                    {/* Unit Switcher */}
                    <div className="inline-flex rounded-lg border border-line p-0.5 bg-surface text-2xs font-bold">
                      <button
                        type="button"
                        onClick={() => {
                          if (glucoseUnit !== 'mg/dL') {
                            setGlucoseUnit('mg/dL');
                            setGlucoseValue(Math.round(mmolToMgDl(glucoseValue)));
                          }
                        }}
                        className={`px-2 py-0.5 rounded cursor-pointer ${
                          glucoseUnit === 'mg/dL'
                            ? 'bg-accent text-content-onaccent'
                            : 'text-content-muted'
                        }`}
                      >
                        mg/dL
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (glucoseUnit !== 'mmol/L') {
                            setGlucoseUnit('mmol/L');
                            setGlucoseValue(parseFloat((glucoseValue / 18.0182).toFixed(1)));
                          }
                        }}
                        className={`px-2 py-0.5 rounded cursor-pointer ${
                          glucoseUnit === 'mmol/L'
                            ? 'bg-accent text-content-onaccent'
                            : 'text-content-muted'
                        }`}
                      >
                        mmol/L
                      </button>
                    </div>
                  </div>

                  <div className="flex justify-center py-1">
                    <RollerNumberInput
                      inputRef={glucoseInputRef}
                      value={glucoseValue}
                      unit={glucoseUnit}
                      onChange={setGlucoseValue}
                      min={glucoseUnit === 'mg/dL' ? 30 : 2}
                      max={glucoseUnit === 'mg/dL' ? 500 : 30}
                      step={glucoseUnit === 'mg/dL' ? 1 : 0.1}
                      size="lg"
                      showQuickPills={true}
                    />
                  </div>

                  <p className="text-2xs text-content-subtle pt-2 border-t border-line/60">
                    {gEval.advice}
                  </p>
                </div>
              );
            })()}

            {/* Notes */}
            <div>
              <label
                htmlFor="quick-glucose-notes"
                className="block text-2xs uppercase tracking-wider font-bold text-content-subtle mb-1"
              >
                Notes (Optional)
              </label>
              <input
                id="quick-glucose-notes"
                type="text"
                value={glucoseNotes}
                onChange={(e) => setGlucoseNotes(e.target.value)}
                placeholder="e.g. Before breakfast"
                className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-xs text-content placeholder:text-content-subtle focus:outline-accent"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
              <Button variant="secondary" size="sm" type="button" onClick={onClose}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" type="submit" loading={isSaving}>
                Save Reading
              </Button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSaveBp} className="space-y-4">
            {bpSaveError && <ErrorState compact message={bpSaveError} />}

            {(() => {
              const bpEval = evaluateBloodPressure(systolic, diastolic);
              return (
                <div className="p-4 rounded-2xl bg-surface-sunken/40 border border-line space-y-4">
                  <div className="flex items-center justify-between gap-2 flex-wrap pb-2 border-b border-line/60">
                    <div className="flex items-center gap-2">
                      <span className="text-base font-black text-content tracking-tight font-mono">
                        {systolic} / {diastolic}
                      </span>
                      <span className="text-2xs font-bold text-content-subtle">mmHg</span>
                    </div>
                    <Badge tone={VITAL_TONE[bpEval.tone].badge} size="sm" withIcon>
                      {bpEval.label}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Systolic */}
                    <div className="p-3 rounded-xl bg-surface border border-line flex flex-col items-center space-y-2">
                      <span className="text-2xs uppercase tracking-wider font-bold text-content-subtle">
                        Systolic (Upper)
                      </span>
                      <RollerNumberInput
                        inputRef={systolicInputRef}
                        value={systolic}
                        onChange={setSystolic}
                        min={70}
                        max={240}
                        step={1}
                        size="md"
                        className="w-full"
                      />
                      <div className="flex items-center gap-1 w-full justify-center pt-1 border-t border-line/60">
                        {[110, 120, 130, 140].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setSystolic(preset)}
                            className={`px-2 py-0.5 rounded text-2xs font-bold transition-all cursor-pointer ${
                              systolic === preset
                                ? 'bg-accent text-content-onaccent shadow-2xs'
                                : 'bg-surface-sunken text-content-muted hover:text-content'
                            }`}
                          >
                            {preset}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Diastolic */}
                    <div className="p-3 rounded-xl bg-surface border border-line flex flex-col items-center space-y-2">
                      <span className="text-2xs uppercase tracking-wider font-bold text-content-subtle">
                        Diastolic (Lower)
                      </span>
                      <RollerNumberInput
                        value={diastolic}
                        onChange={setDiastolic}
                        min={40}
                        max={140}
                        step={1}
                        size="md"
                        className="w-full"
                      />
                      <div className="flex items-center gap-1 w-full justify-center pt-1 border-t border-line/60">
                        {[70, 80, 85, 90].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setDiastolic(preset)}
                            className={`px-2 py-0.5 rounded text-2xs font-bold transition-all cursor-pointer ${
                              diastolic === preset
                                ? 'bg-accent text-content-onaccent shadow-2xs'
                                : 'bg-surface-sunken text-content-muted hover:text-content'
                            }`}
                          >
                            {preset}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <p className="text-2xs text-content-muted leading-relaxed">{bpEval.advice}</p>
                </div>
              );
            })()}

            {/* Pulse Rate */}
            <div className="p-3 rounded-2xl bg-surface-sunken/40 border border-line flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <HeartPulseIcon size={16} className="text-rose-500 shrink-0" />
                <div>
                  <span className="text-xs font-bold text-content block">Pulse Rate</span>
                  <span className="text-2xs text-content-subtle">Resting heart rate</span>
                </div>
              </div>
              <RollerNumberInput
                unit="bpm"
                value={pulse}
                onChange={setPulse}
                min={40}
                max={200}
                step={1}
                size="sm"
              />
            </div>

            {/* Arm and Posture */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="block text-2xs uppercase tracking-wider font-bold text-content-subtle mb-1">
                  Arm
                </span>
                <div className="grid grid-cols-2 gap-1">
                  {(['left', 'right'] as const).map((arm) => (
                    <button
                      key={arm}
                      type="button"
                      onClick={() => setBpArm(arm)}
                      className={`px-2 py-1 rounded-lg text-xs font-bold capitalize border cursor-pointer ${
                        bpArm === arm
                          ? 'bg-accent text-content-onaccent border-accent'
                          : 'bg-surface border-line text-content-muted'
                      }`}
                    >
                      {arm}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <span className="block text-2xs uppercase tracking-wider font-bold text-content-subtle mb-1">
                  Posture
                </span>
                <div className="grid grid-cols-3 gap-1">
                  {(['sitting', 'standing', 'lying'] as const).map((posture) => (
                    <button
                      key={posture}
                      type="button"
                      onClick={() => setBpPosture(posture)}
                      className={`px-1 py-1 rounded-lg text-2xs font-bold capitalize border truncate cursor-pointer ${
                        bpPosture === posture
                          ? 'bg-accent text-content-onaccent border-accent'
                          : 'bg-surface border-line text-content-muted'
                      }`}
                    >
                      {posture}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label
                htmlFor="quick-bp-notes"
                className="block text-2xs uppercase tracking-wider font-bold text-content-subtle mb-1"
              >
                Notes (Optional)
              </label>
              <input
                id="quick-bp-notes"
                type="text"
                value={bpNotes}
                onChange={(e) => setBpNotes(e.target.value)}
                placeholder="e.g. After 5 min resting"
                className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-xs text-content placeholder:text-content-subtle focus:outline-accent"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
              <Button variant="secondary" size="sm" type="button" onClick={onClose}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" type="submit" loading={isSaving}>
                Save BP Log
              </Button>
            </div>
          </form>
        )}
      </div>
    </Dialog>
  );
}
