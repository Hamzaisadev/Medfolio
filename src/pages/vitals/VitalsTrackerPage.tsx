import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AppShell } from '../../components/layout/AppShell';
import { useAuth } from '../../lib/auth/AuthContext';
import {
  listGlucoseReadings,
  createGlucoseReading,
  deleteGlucoseReading,
  listBloodPressureReadings,
  createBloodPressureReading,
  deleteBloodPressureReading,
} from '../../lib/db/vitals';
import {
  GlucoseReading,
  BloodPressureReading,
  GlucoseType,
  evaluateGlucose,
  evaluateBloodPressure,
  calculateMap,
  mmolToMgDl,
  mgDlToMmol,
} from '../../domain/vitals';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Select } from '../../components/ui/Select';
import { Dialog } from '../../components/ui/Dialog';
import { ErrorState } from '../../components/ui/ErrorState';
import { VitalsGauge } from '../../components/ui/VitalsGauge';
import { RollingNumber } from '../../components/ui/RollingNumber';
import { RollerNumberInput } from '../../components/ui/RollerNumberInput';
import { VITAL_TONE } from '../../components/ui/vitalTone';
import { HeartPulseIcon, DropletIcon, XIcon } from '../../components/ui/icons';
import { staggerContainer, staggerItem } from '../../lib/motion';

export function VitalsTrackerPage() {
  const { user, profile } = useAuth();
  const effectiveUserId = user?.id || profile?.user_id || '';
  const effectiveProfileId = profile?.id || effectiveUserId;

  const [activeTab, setActiveTab] = useState<'glucose' | 'bp'>('glucose');
  const [glucoseLogs, setGlucoseLogs] = useState<GlucoseReading[]>([]);
  const [bpLogs, setBpLogs] = useState<BloodPressureReading[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Glucose Entry Form State
  const [isGlucoseModalOpen, setIsGlucoseModalOpen] = useState(false);
  const [glucoseType, setGlucoseType] = useState<GlucoseType>('fasting');
  const [glucoseValue, setGlucoseValue] = useState<number>(100);
  const [glucoseUnit, setGlucoseUnit] = useState<'mg/dL' | 'mmol/L'>('mg/dL');
  const [glucoseNotes, setGlucoseNotes] = useState('');
  const [glucoseSaveError, setGlucoseSaveError] = useState<string | null>(null);

  // Blood Pressure Entry Form State
  const [isBpModalOpen, setIsBpModalOpen] = useState(false);
  const [systolic, setSystolic] = useState<number>(120);
  const [diastolic, setDiastolic] = useState<number>(80);
  const [pulse, setPulse] = useState<number>(72);
  const [bpArm, setBpArm] = useState<'left' | 'right'>('left');
  const [bpPosture, setBpPosture] = useState<'sitting' | 'standing' | 'lying'>('sitting');
  const [bpNotes, setBpNotes] = useState('');
  const [bpSaveError, setBpSaveError] = useState<string | null>(null);

  const [isSaving, setIsSaving] = useState(false);

  const loadData = useCallback(async () => {
    if (!effectiveProfileId) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const [gData, bData] = await Promise.all([
        listGlucoseReadings(effectiveProfileId),
        listBloodPressureReadings(effectiveProfileId),
      ]);
      setGlucoseLogs(gData);
      setBpLogs(bData);
    } catch (err) {
      console.error('Failed to load vitals:', err);
      setLoadError('Your vitals history could not be loaded. Check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  }, [effectiveProfileId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle Glucose Submission
  const handleSaveGlucose = async (e: React.FormEvent) => {
    e.preventDefault();
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
      setIsGlucoseModalOpen(false);
      setGlucoseNotes('');
      await loadData();
    } catch (err) {
      console.error('Failed to save glucose reading:', err);
      setGlucoseSaveError('Could not save reading. Check your connection.');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Blood Pressure Submission
  const handleSaveBp = async (e: React.FormEvent) => {
    e.preventDefault();
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
      setIsBpModalOpen(false);
      setBpNotes('');
      await loadData();
    } catch (err) {
      console.error('Failed to save blood pressure reading:', err);
      setBpSaveError('Could not save BP log. Check your connection.');
    } finally {
      setIsSaving(false);
    }
  };

  // Vitals Statistics Computations
  const glucoseStats = useMemo(() => {
    if (glucoseLogs.length === 0) return null;
    const values = glucoseLogs.map((g) => g.value_mg_dl);
    const avg = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
    const inRange = glucoseLogs.filter((g) => evaluateGlucose(g.value_mg_dl, g.type).status === 'normal').length;
    const inRangePercent = Math.round((inRange / glucoseLogs.length) * 100);

    return {
      avg,
      min: Math.min(...values),
      max: Math.max(...values),
      inRangePercent,
      latest: glucoseLogs[0],
    };
  }, [glucoseLogs]);

  const bpStats = useMemo(() => {
    if (bpLogs.length === 0) return null;
    const sysAvg = Math.round(bpLogs.reduce((a, b) => a + b.systolic, 0) / bpLogs.length);
    const diaAvg = Math.round(bpLogs.reduce((a, b) => a + b.diastolic, 0) / bpLogs.length);
    const map = calculateMap(sysAvg, diaAvg);
    const normalCount = bpLogs.filter((b) => evaluateBloodPressure(b.systolic, b.diastolic).stage === 'normal').length;
    const normalPercent = Math.round((normalCount / bpLogs.length) * 100);

    return {
      sysAvg,
      diaAvg,
      map,
      normalPercent,
      total: bpLogs.length,
      latest: bpLogs[0],
    };
  }, [bpLogs]);

  return (
    <AppShell>
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="space-y-6 max-w-4xl mx-auto"
      >
        {/* Header with quick log actions */}
        <motion.div variants={staggerItem} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-content tracking-tight flex items-center gap-2">
              <span>Chronic Vitals Radar</span>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-accent-subtle text-accent border border-accent/20">
                Daily Tracker
              </span>
            </h1>
            <p className="text-xs sm:text-sm text-content-muted mt-1">
              Precision logging and clinical target analytics for diabetes and hypertension management.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {activeTab === 'glucose' ? (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsGlucoseModalOpen(true)}
                leftIcon={<DropletIcon size={16} />}
              >
                Log Blood Sugar
              </Button>
            ) : (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsBpModalOpen(true)}
                leftIcon={<HeartPulseIcon size={16} />}
              >
                Log Blood Pressure
              </Button>
            )}
          </div>
        </motion.div>

        {/* Tab Toggle with Sliding layout animation */}
        <motion.div variants={staggerItem} className="flex items-center gap-2 p-1 rounded-xl bg-surface-sunken w-fit relative border border-line">
          <button
            type="button"
            onClick={() => setActiveTab('glucose')}
            className={`relative px-4 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'glucose' ? 'text-accent' : 'text-content-muted hover:text-content'
            }`}
          >
            {activeTab === 'glucose' && (
              <motion.div
                layoutId="vitals-tab-pill"
                className="absolute inset-0 rounded-lg bg-surface-raised shadow-xs"
                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
              />
            )}
            <DropletIcon size={14} className="relative z-10" />
            <span className="relative z-10">Blood Glucose ({glucoseLogs.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('bp')}
            className={`relative px-4 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'bp' ? 'text-risk-text' : 'text-content-muted hover:text-content'
            }`}
          >
            {activeTab === 'bp' && (
              <motion.div
                layoutId="vitals-tab-pill"
                className="absolute inset-0 rounded-lg bg-surface-raised shadow-xs"
                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
              />
            )}
            <HeartPulseIcon size={14} className="relative z-10" />
            <span className="relative z-10">Blood Pressure ({bpLogs.length})</span>
          </button>
        </motion.div>

        {loadError ? (
          <ErrorState
            title="Vitals didn't load"
            message={loadError}
            onRetry={loadData}
          />
        ) : (
          <AnimatePresence mode="wait">
            {/* ── BLOOD GLUCOSE TAB ──────────────────────────────────── */}
            {activeTab === 'glucose' && (
              <motion.div
                key="glucose-tab"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                {/* Visual Gauge + Stats Overview */}
                {glucoseStats && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <VitalsGauge
                      value={glucoseStats.latest?.value_mg_dl || glucoseStats.avg}
                      min={40}
                      max={300}
                      targetMin={70}
                      targetMax={140}
                      label="Latest Reading"
                      unit="mg/dL"
                      tone={evaluateGlucose(glucoseStats.latest?.value_mg_dl || glucoseStats.avg, glucoseStats.latest?.type || 'fasting').status === 'normal' ? 'ok' : 'warn'}
                      statusText={evaluateGlucose(glucoseStats.latest?.value_mg_dl || glucoseStats.avg, glucoseStats.latest?.type || 'fasting').label}
                    />

                    <div className="md:col-span-2 grid grid-cols-2 gap-3">
                      <div className="p-4 rounded-2xl bg-surface-raised border border-line shadow-card flex flex-col justify-center">
                        <p className="text-2xs uppercase font-bold text-content-subtle">Average Level</p>
                        <p className="text-2xl font-black text-content mt-1">
                          <RollingNumber value={glucoseStats.avg} /> <span className="text-xs font-semibold text-content-subtle">mg/dL</span>
                        </p>
                        <p className="text-2xs text-content-subtle mt-0.5">({mgDlToMmol(glucoseStats.avg)} mmol/L)</p>
                      </div>

                      <div className="p-4 rounded-2xl bg-surface-raised border border-line shadow-card flex flex-col justify-center">
                        <p className="text-2xs uppercase font-bold text-content-subtle">Target Adherence</p>
                        <p className="text-2xl font-black text-ok-text mt-1">
                          <RollingNumber value={glucoseStats.inRangePercent} suffix="%" />
                        </p>
                        <p className="text-2xs text-content-subtle mt-0.5">In ADA Target Zone</p>
                      </div>

                      <div className="p-4 rounded-2xl bg-surface-raised border border-line shadow-card flex flex-col justify-center">
                        <p className="text-2xs uppercase font-bold text-content-subtle">Lowest Reading</p>
                        <p className="text-2xl font-black text-content mt-1">
                          <RollingNumber value={glucoseStats.min} suffix=" mg/dL" />
                        </p>
                        <p className="text-2xs text-content-subtle mt-0.5">Past 30 days</p>
                      </div>

                      <div className="p-4 rounded-2xl bg-surface-raised border border-line shadow-card flex flex-col justify-center">
                        <p className="text-2xs uppercase font-bold text-content-subtle">Peak Spike</p>
                        <p className="text-2xl font-black text-risk-text mt-1">
                          <RollingNumber value={glucoseStats.max} suffix=" mg/dL" />
                        </p>
                        <p className="text-2xs text-content-subtle mt-0.5">Past 30 days</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Glucose Logs List */}
                <div className="bg-surface-raised border border-line rounded-2xl overflow-hidden shadow-card">
                  <div className="p-4 border-b border-line flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-content-muted">
                      Recent Blood Glucose Logs
                    </h3>
                    <span className="text-2xs text-content-subtle">{glucoseLogs.length} total entries</span>
                  </div>

                  {isLoading ? (
                    <div className="p-8 text-center text-xs text-content-subtle">Loading glucose history...</div>
                  ) : glucoseLogs.length === 0 ? (
                    <div className="p-8 text-center space-y-2">
                      <p className="text-xs text-content-muted">No blood glucose entries logged yet.</p>
                      <Button variant="secondary" size="sm" onClick={() => setIsGlucoseModalOpen(true)}>
                        + Log Your First Reading
                      </Button>
                    </div>
                  ) : (
                    <div className="divide-y divide-line">
                      {glucoseLogs.map((log) => {
                        const evalResult = evaluateGlucose(log.value_mg_dl, log.type);
                        return (
                          <div key={log.id} className="p-4 flex items-center justify-between gap-3 hover:bg-surface-hover transition-colors">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-10 h-10 rounded-xl bg-accent-subtle text-accent border border-line flex items-center justify-center font-bold text-xs shrink-0">
                                {log.value_mg_dl}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-xs font-bold text-content capitalize">
                                    {log.type.replace('_', ' ')}
                                  </span>
                                  <Badge tone={VITAL_TONE[evalResult.tone].badge} size="sm" withIcon>
                                    {evalResult.label}
                                  </Badge>
                                </div>
                                <p className="text-2xs text-content-subtle mt-0.5">
                                  {new Date(log.measured_at).toLocaleDateString()} at {new Date(log.measured_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  {log.notes && ` • "${log.notes}"`}
                                </p>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => log.id && deleteGlucoseReading(log.id).then(loadData)}
                              className="text-content-subtle hover:text-risk-text p-1.5 rounded hover:bg-surface-hover transition-colors cursor-pointer"
                              title="Delete entry"
                              aria-label="Delete glucose entry"
                            >
                              <XIcon className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* ── BLOOD PRESSURE TAB ──────────────────────────────────── */}
            {activeTab === 'bp' && (
              <motion.div
                key="bp-tab"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                {/* Visual Gauge + Stats Overview */}
                {bpStats && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <VitalsGauge
                      value={bpStats.latest ? bpStats.latest.systolic : bpStats.sysAvg}
                      min={70}
                      max={200}
                      targetMin={90}
                      targetMax={120}
                      label="Systolic Pressure"
                      unit="mmHg"
                      tone={evaluateBloodPressure(bpStats.latest?.systolic || bpStats.sysAvg, bpStats.latest?.diastolic || bpStats.diaAvg).stage === 'normal' ? 'ok' : 'risk'}
                      statusText={evaluateBloodPressure(bpStats.latest?.systolic || bpStats.sysAvg, bpStats.latest?.diastolic || bpStats.diaAvg).label}
                    />

                    <div className="md:col-span-2 grid grid-cols-2 gap-3">
                      <div className="p-4 rounded-2xl bg-surface-raised border border-line shadow-card flex flex-col justify-center">
                        <p className="text-2xs uppercase font-bold text-content-subtle">Average BP</p>
                        <p className="text-2xl font-black text-content mt-1">
                          <RollingNumber value={bpStats.sysAvg} />/<RollingNumber value={bpStats.diaAvg} /> <span className="text-xs font-semibold text-content-subtle">mmHg</span>
                        </p>
                        <p className="text-2xs text-content-subtle mt-0.5">30-day average</p>
                      </div>

                      <div className="p-4 rounded-2xl bg-surface-raised border border-line shadow-card flex flex-col justify-center">
                        <p className="text-2xs uppercase font-bold text-content-subtle">Mean Arterial (MAP)</p>
                        <p className="text-2xl font-black text-accent mt-1">
                          <RollingNumber value={bpStats.map} suffix=" mmHg" />
                        </p>
                        <p className="text-2xs text-content-subtle mt-0.5">Organ perfusion index</p>
                      </div>

                      <div className="p-4 rounded-2xl bg-surface-raised border border-line shadow-card flex flex-col justify-center">
                        <p className="text-2xs uppercase font-bold text-content-subtle">Normal Range</p>
                        <p className="text-2xl font-black text-ok-text mt-1">
                          <RollingNumber value={bpStats.normalPercent} suffix="%" />
                        </p>
                        <p className="text-2xs text-content-subtle mt-0.5">Optimal AHA readings</p>
                      </div>

                      <div className="p-4 rounded-2xl bg-surface-raised border border-line shadow-card flex flex-col justify-center">
                        <p className="text-2xs uppercase font-bold text-content-subtle">Total Logs</p>
                        <p className="text-2xl font-black text-content mt-1">
                          <RollingNumber value={bpStats.total} />
                        </p>
                        <p className="text-2xs text-content-subtle mt-0.5">Cardio log entries</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* BP Logs List */}
                <div className="bg-surface-raised border border-line rounded-2xl overflow-hidden shadow-card">
                  <div className="p-4 border-b border-line flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-content-muted">
                      Recent Blood Pressure Logs
                    </h3>
                    <span className="text-2xs text-content-subtle">{bpLogs.length} total entries</span>
                  </div>

                  {isLoading ? (
                    <div className="p-8 text-center text-xs text-content-subtle">Loading blood pressure history...</div>
                  ) : bpLogs.length === 0 ? (
                    <div className="p-8 text-center space-y-2">
                      <p className="text-xs text-content-muted">No blood pressure logs recorded yet.</p>
                      <Button variant="secondary" size="sm" onClick={() => setIsBpModalOpen(true)}>
                        + Log Your First BP Reading
                      </Button>
                    </div>
                  ) : (
                    <div className="divide-y divide-line">
                      {bpLogs.map((log) => {
                        const evalResult = evaluateBloodPressure(log.systolic, log.diastolic);
                        return (
                          <div key={log.id} className="p-4 flex items-center justify-between gap-3 hover:bg-surface-hover transition-colors">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-12 h-10 rounded-xl bg-risk-bg text-risk-text border border-risk-border flex items-center justify-center font-bold text-xs shrink-0">
                                {log.systolic}/{log.diastolic}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <Badge tone={VITAL_TONE[evalResult.tone].badge} size="sm" withIcon>
                                    {evalResult.label}
                                  </Badge>
                                  {log.pulse_bpm && (
                                    <span className="text-2xs font-semibold text-risk-text bg-risk-bg px-2 py-0.5 rounded border border-risk-border flex items-center gap-1">
                                      <HeartPulseIcon className="w-3 h-3" /> {log.pulse_bpm} bpm
                                    </span>
                                  )}
                                  {log.arm && (
                                    <span className="text-2xs text-content-subtle capitalize">
                                      {log.arm} arm • {log.posture || 'sitting'}
                                    </span>
                                  )}
                                </div>
                                <p className="text-2xs text-content-subtle mt-0.5">
                                  {new Date(log.measured_at).toLocaleDateString()} at {new Date(log.measured_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  {log.notes && ` • "${log.notes}"`}
                                </p>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => log.id && deleteBloodPressureReading(log.id).then(loadData)}
                              className="text-content-subtle hover:text-risk-text p-1.5 rounded hover:bg-surface-hover transition-colors cursor-pointer"
                              title="Delete entry"
                              aria-label="Delete blood pressure entry"
                            >
                              <XIcon className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        )}

        {/* GLUCOSE MODAL */}
        <Dialog
          open={isGlucoseModalOpen}
          onOpenChange={setIsGlucoseModalOpen}
          title="Log Blood Glucose"
          description="Type, scroll, or tap + / − to set your reading."
          className="max-w-md"
        >
          <form onSubmit={handleSaveGlucose} className="space-y-5">
            {glucoseSaveError && <ErrorState compact message={glucoseSaveError} />}

            <div>
              <span className="block text-xs font-bold text-content mb-2">Meal Timing</span>
              <div className="grid grid-cols-2 gap-2">
                {(['fasting', 'post_prandial', 'random', 'bedtime'] as GlucoseType[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setGlucoseType(t)}
                    className={`py-2 px-3 rounded-xl text-xs font-bold capitalize transition-colors border cursor-pointer ${
                      glucoseType === t
                        ? 'bg-accent-subtle border-accent text-accent shadow-xs'
                        : 'bg-surface-raised border-line text-content-muted hover:bg-surface-hover'
                    }`}
                  >
                    {t.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            {/* Stepper Card for Glucose */}
            <div className="p-5 rounded-2xl bg-surface-sunken/40 border border-line flex flex-col items-center justify-center space-y-3">
              <div className="flex items-center justify-between w-full">
                <span className="text-xs font-bold text-content-muted">Glucose Reading</span>
                <div className="flex items-center gap-1 bg-surface-raised border border-line p-0.5 rounded-lg">
                  {(['mg/dL', 'mmol/L'] as const).map((unit) => (
                    <button
                      key={unit}
                      type="button"
                      onClick={() => {
                        if (unit !== glucoseUnit) {
                          if (unit === 'mmol/L') {
                            setGlucoseValue(mgDlToMmol(glucoseValue));
                          } else {
                            setGlucoseValue(Math.round(mmolToMgDl(glucoseValue)));
                          }
                          setGlucoseUnit(unit);
                        }
                      }}
                      className={`px-2 py-0.5 rounded text-2xs font-bold transition-colors cursor-pointer ${
                        glucoseUnit === unit
                          ? 'bg-accent text-white shadow-xs'
                          : 'text-content-subtle hover:text-content'
                      }`}
                    >
                      {unit}
                    </button>
                  ))}
                </div>
              </div>

              <RollerNumberInput
                unit={glucoseUnit}
                value={glucoseValue}
                onChange={setGlucoseValue}
                min={glucoseUnit === 'mg/dL' ? 30 : 2}
                max={glucoseUnit === 'mg/dL' ? 500 : 30}
                step={glucoseUnit === 'mg/dL' ? 1 : 0.1}
                size="lg"
                showQuickPills={true}
              />
              <p className="text-2xs text-content-subtle">
                Click & type directly, or hover and scroll mouse wheel
              </p>
            </div>

            <div>
              <label htmlFor="glucose-notes" className="block text-xs font-bold text-content mb-1">Notes (Optional)</label>
              <input
                id="glucose-notes"
                type="text"
                value={glucoseNotes}
                onChange={(e) => setGlucoseNotes(e.target.value)}
                placeholder="e.g. 2 hours after breakfast"
                className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-xs text-content focus:outline-accent"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="secondary" size="sm" type="button" onClick={() => setIsGlucoseModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" type="submit" loading={isSaving}>
                Save Reading
              </Button>
            </div>
          </form>
        </Dialog>

        {/* BP MODAL */}
        <Dialog
          open={isBpModalOpen}
          onOpenChange={setIsBpModalOpen}
          title="Log Blood Pressure"
          description="Type, scroll, or tap + / − to set your BP reading."
          className="max-w-lg"
        >
          <form onSubmit={handleSaveBp} className="space-y-5">
            {bpSaveError && <ErrorState compact message={bpSaveError} />}

            {/* Steppers for BP */}
            <div className="p-4 rounded-2xl bg-surface-sunken/40 border border-line space-y-3">
              <div className="flex items-center justify-around gap-2 flex-wrap sm:flex-nowrap">
                <RollerNumberInput
                  label="Systolic"
                  unit="mmHg"
                  value={systolic}
                  onChange={setSystolic}
                  min={70}
                  max={240}
                  step={1}
                  size="md"
                />
                <span className="text-2xl font-black text-content-subtle mt-4">/</span>
                <RollerNumberInput
                  label="Diastolic"
                  unit="mmHg"
                  value={diastolic}
                  onChange={setDiastolic}
                  min={40}
                  max={140}
                  step={1}
                  size="md"
                />
                <RollerNumberInput
                  label="Pulse"
                  unit="bpm"
                  value={pulse}
                  onChange={setPulse}
                  min={40}
                  max={200}
                  step={1}
                  size="sm"
                />
              </div>
              <p className="text-center text-2xs text-content-subtle">
                Click any number to type directly, or hover and scroll mouse wheel
              </p>
            </div>

            {/* Collapsible Advanced Details (Arm, Posture, Notes) */}
            <details className="group rounded-xl border border-line bg-surface p-3 text-xs">
              <summary className="cursor-pointer font-bold text-content-muted hover:text-content flex items-center justify-between list-none">
                <span>More options (Arm, Posture, Notes)</span>
                <span className="text-content-subtle group-open:rotate-180 transition-transform">▼</span>
              </summary>

              <div className="mt-3 pt-3 border-t border-line space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label htmlFor="bp-arm" className="block text-xs font-bold text-content mb-1">Arm</label>
                    <Select
                      id="bp-arm"
                      value={bpArm}
                      onValueChange={(val) => setBpArm(val as 'left' | 'right')}
                      options={[
                        { value: 'left', label: 'Left Arm' },
                        { value: 'right', label: 'Right Arm' },
                      ]}
                      className="h-9 text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label htmlFor="bp-posture" className="block text-xs font-bold text-content mb-1">Posture</label>
                    <Select
                      id="bp-posture"
                      value={bpPosture}
                      onValueChange={(val) => setBpPosture(val as 'sitting' | 'standing' | 'lying')}
                      options={[
                        { value: 'sitting', label: 'Sitting' },
                        { value: 'standing', label: 'Standing' },
                        { value: 'lying', label: 'Lying Down' },
                      ]}
                      className="h-9 text-xs font-bold"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="bp-notes" className="block text-xs font-bold text-content mb-1">Notes</label>
                  <input
                    id="bp-notes"
                    type="text"
                    value={bpNotes}
                    onChange={(e) => setBpNotes(e.target.value)}
                    placeholder="e.g. Morning reading before coffee"
                    className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-xs text-content focus:outline-accent"
                  />
                </div>
              </div>
            </details>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="secondary" size="sm" type="button" onClick={() => setIsBpModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" type="submit" loading={isSaving}>
                Save BP Log
              </Button>
            </div>
          </form>
        </Dialog>
      </motion.div>
    </AppShell>
  );
}
