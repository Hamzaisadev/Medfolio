import { useState, useEffect, useMemo, useCallback } from 'react';
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
import { VITAL_TONE } from '../../components/ui/vitalTone';
import { HeartPulseIcon, XIcon } from '../../components/ui/icons';

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
  const [glucoseValue, setGlucoseValue] = useState('');
  const [glucoseUnit, setGlucoseUnit] = useState<'mg/dL' | 'mmol/L'>('mg/dL');
  const [glucoseNotes, setGlucoseNotes] = useState('');
  const [glucoseSaveError, setGlucoseSaveError] = useState<string | null>(null);

  // Blood Pressure Entry Form State
  const [isBpModalOpen, setIsBpModalOpen] = useState(false);
  const [systolic, setSystolic] = useState('');
  const [diastolic, setDiastolic] = useState('');
  const [pulse, setPulse] = useState('');
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

    let mgDl = parseFloat(glucoseValue);
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
      setGlucoseValue('');
      setGlucoseNotes('');
      setIsGlucoseModalOpen(false);
      loadData();
    } catch (err) {
      console.error('Failed to save glucose reading:', err);
      // Keep the dialog open with the entered values intact so nothing is lost.
      setGlucoseSaveError('The reading could not be saved. Check your connection and try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle BP Submission
  const handleSaveBp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!systolic || !diastolic || !effectiveUserId || !effectiveProfileId || isSaving) return;

    const newReading: BloodPressureReading = {
      user_id: effectiveUserId,
      profile_id: effectiveProfileId,
      measured_at: new Date().toISOString(),
      systolic: parseInt(systolic, 10),
      diastolic: parseInt(diastolic, 10),
      pulse_bpm: pulse ? parseInt(pulse, 10) : undefined,
      arm: bpArm,
      posture: bpPosture,
      notes: bpNotes.trim() || undefined,
    };

    setIsSaving(true);
    setBpSaveError(null);
    try {
      await createBloodPressureReading(newReading);
      setSystolic('');
      setDiastolic('');
      setPulse('');
      setBpNotes('');
      setIsBpModalOpen(false);
      loadData();
    } catch (err) {
      console.error('Failed to save blood pressure reading:', err);
      setBpSaveError('The reading could not be saved. Check your connection and try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Quick Analytics
  const glucoseStats = useMemo(() => {
    if (glucoseLogs.length === 0) return null;
    const values = glucoseLogs.map((g) => g.value_mg_dl);
    const avg = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
    const inRangeCount = glucoseLogs.filter((g) => {
      const evalRes = evaluateGlucose(g.value_mg_dl, g.type);
      return evalRes.status === 'normal';
    }).length;
    const inRangePercent = Math.round((inRangeCount / glucoseLogs.length) * 100);

    return {
      avg,
      min: Math.min(...values),
      max: Math.max(...values),
      inRangePercent,
      total: glucoseLogs.length,
    };
  }, [glucoseLogs]);

  const bpStats = useMemo(() => {
    if (bpLogs.length === 0) return null;
    const sysAvg = Math.round(bpLogs.reduce((a, b) => a + b.systolic, 0) / bpLogs.length);
    const diaAvg = Math.round(bpLogs.reduce((a, b) => a + b.diastolic, 0) / bpLogs.length);
    const normalCount = bpLogs.filter((b) => {
      const evalRes = evaluateBloodPressure(b.systolic, b.diastolic);
      return evalRes.stage === 'normal';
    }).length;
    const normalPercent = Math.round((normalCount / bpLogs.length) * 100);

    return {
      sysAvg,
      diaAvg,
      map: calculateMap(sysAvg, diaAvg),
      normalPercent,
      total: bpLogs.length,
    };
  }, [bpLogs]);

  return (
    <AppShell>
      <div className="space-y-6 max-w-4xl mx-auto pb-12">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line pb-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-content tracking-tight flex items-center gap-2">
              <span>Chronic Vitals Radar</span>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-risk-bg text-risk-text border border-risk-border">
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
              >
                + Log Blood Sugar
              </Button>
            ) : (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsBpModalOpen(true)}
              >
                + Log Blood Pressure
              </Button>
            )}
          </div>
        </div>

        {/* Tab Toggle */}
        <div className="flex items-center gap-2 p-1 rounded-xl bg-surface-sunken w-fit">
          <button
            type="button"
            onClick={() => setActiveTab('glucose')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'glucose'
                ? 'bg-surface-raised text-accent shadow-xs'
                : 'text-content-muted hover:text-content'
            }`}
          >
            🩸 Blood Glucose ({glucoseLogs.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('bp')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'bp'
                ? 'bg-surface-raised text-risk-text shadow-xs'
                : 'text-content-muted hover:text-content'
            }`}
          >
            🩺 Blood Pressure ({bpLogs.length})
          </button>
        </div>

        {loadError ? (
          <ErrorState
            title="Vitals didn't load"
            message={loadError}
            onRetry={loadData}
          />
        ) : (
          <>
            {/* 🩸 BLOOD GLUCOSE TAB */}
            {activeTab === 'glucose' && (
              <div className="space-y-6">
                {/* Stats Overview */}
                {glucoseStats && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-4 rounded-2xl bg-surface-raised border border-line shadow-2xs">
                      <p className="text-2xs uppercase font-bold text-content-subtle">Average Level</p>
                      <p className="text-xl font-black text-content mt-1">
                        {glucoseStats.avg} <span className="text-xs font-semibold text-content-subtle">mg/dL</span>
                      </p>
                      <p className="text-2xs text-content-subtle mt-0.5">({mgDlToMmol(glucoseStats.avg)} mmol/L)</p>
                    </div>

                    <div className="p-4 rounded-2xl bg-surface-raised border border-line shadow-2xs">
                      <p className="text-2xs uppercase font-bold text-content-subtle">Target Adherence</p>
                      <p className="text-xl font-black text-ok-text mt-1">{glucoseStats.inRangePercent}%</p>
                      <p className="text-2xs text-content-subtle mt-0.5">In ADA Target Zone</p>
                    </div>

                    <div className="p-4 rounded-2xl bg-surface-raised border border-line shadow-2xs">
                      <p className="text-2xs uppercase font-bold text-content-subtle">Lowest Reading</p>
                      <p className="text-xl font-black text-content mt-1">{glucoseStats.min} mg/dL</p>
                      <p className="text-2xs text-content-subtle mt-0.5">Past 30 days</p>
                    </div>

                    <div className="p-4 rounded-2xl bg-surface-raised border border-line shadow-2xs">
                      <p className="text-2xs uppercase font-bold text-content-subtle">Peak Spike</p>
                      <p className="text-xl font-black text-risk-text mt-1">{glucoseStats.max} mg/dL</p>
                      <p className="text-2xs text-content-subtle mt-0.5">Past 30 days</p>
                    </div>
                  </div>
                )}

                {/* Glucose Logs List */}
                <div className="bg-surface-raised border border-line rounded-2xl overflow-hidden shadow-2xs">
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
                          <div key={log.id} className="p-4 flex items-center justify-between gap-3 hover:bg-surface-hover/50 transition-colors">
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
                              className="text-content-subtle hover:text-risk-text p-1.5 rounded hover:bg-surface-hover transition-colors"
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
              </div>
            )}

            {/* BLOOD PRESSURE TAB */}
            {activeTab === 'bp' && (
              <div className="space-y-6">
                {/* Stats Overview */}
                {bpStats && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-4 rounded-2xl bg-surface-raised border border-line shadow-2xs">
                      <p className="text-2xs uppercase font-bold text-content-subtle">Average BP</p>
                      <p className="text-xl font-black text-content mt-1">
                        {bpStats.sysAvg}/{bpStats.diaAvg} <span className="text-xs font-semibold text-content-subtle">mmHg</span>
                      </p>
                      <p className="text-2xs text-content-subtle mt-0.5">30-day average</p>
                    </div>

                    <div className="p-4 rounded-2xl bg-surface-raised border border-line shadow-2xs">
                      <p className="text-2xs uppercase font-bold text-content-subtle">Mean Arterial Pressure (MAP)</p>
                      <p className="text-xl font-black text-accent mt-1">{bpStats.map} mmHg</p>
                      <p className="text-2xs text-content-subtle mt-0.5">Organ perfusion index</p>
                    </div>

                    <div className="p-4 rounded-2xl bg-surface-raised border border-line shadow-2xs">
                      <p className="text-2xs uppercase font-bold text-content-subtle">Normal Range</p>
                      <p className="text-xl font-black text-ok-text mt-1">{bpStats.normalPercent}%</p>
                      <p className="text-2xs text-content-subtle mt-0.5">Optimal AHA readings</p>
                    </div>

                    <div className="p-4 rounded-2xl bg-surface-raised border border-line shadow-2xs">
                      <p className="text-2xs uppercase font-bold text-content-subtle">Total Logs</p>
                      <p className="text-xl font-black text-content mt-1">{bpStats.total}</p>
                      <p className="text-2xs text-content-subtle mt-0.5">Cardio log entries</p>
                    </div>
                  </div>
                )}

                {/* BP Logs List */}
                <div className="bg-surface-raised border border-line rounded-2xl overflow-hidden shadow-2xs">
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
                          <div key={log.id} className="p-4 flex items-center justify-between gap-3 hover:bg-surface-hover/50 transition-colors">
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
                              className="text-content-subtle hover:text-risk-text p-1.5 rounded hover:bg-surface-hover transition-colors"
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
              </div>
            )}
          </>
        )}

        {/* GLUCOSE MODAL */}
        <Dialog
          open={isGlucoseModalOpen}
          onOpenChange={setIsGlucoseModalOpen}
          title="Log Blood Glucose"
          description="Record a new blood sugar reading."
          className="max-w-md"
        >
          <form onSubmit={handleSaveGlucose} className="space-y-4">
            {glucoseSaveError && <ErrorState compact message={glucoseSaveError} />}

            <div>
              <span className="block text-xs font-bold text-content mb-1">Measurement Type</span>
              <div className="grid grid-cols-2 gap-2">
                {(['fasting', 'post_prandial', 'random', 'bedtime'] as GlucoseType[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setGlucoseType(t)}
                    className={`py-2 px-3 rounded-xl text-xs font-bold capitalize transition-colors border ${
                      glucoseType === t
                        ? 'bg-accent-subtle border-accent text-accent'
                        : 'bg-surface-raised border-line text-content-muted hover:bg-surface-hover'
                    }`}
                  >
                    {t.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <label htmlFor="glucose-value" className="block text-xs font-bold text-content mb-1">Glucose Reading</label>
                <input
                  id="glucose-value"
                  type="number"
                  step="any"
                  required
                  value={glucoseValue}
                  onChange={(e) => setGlucoseValue(e.target.value)}
                  placeholder={glucoseUnit === 'mg/dL' ? 'e.g. 95' : 'e.g. 5.3'}
                  className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-sm font-bold text-content focus:outline-accent"
                />
              </div>
              <div>
                <label htmlFor="glucose-unit" className="block text-xs font-bold text-content mb-1">Unit</label>
                <Select
                  id="glucose-unit"
                  value={glucoseUnit}
                  onValueChange={(val) => setGlucoseUnit(val as 'mg/dL' | 'mmol/L')}
                  options={[
                    { value: 'mg/dL', label: 'mg/dL' },
                    { value: 'mmol/L', label: 'mmol/L' },
                  ]}
                  className="h-10 text-xs font-bold"
                />
              </div>
            </div>

            <div>
              <label htmlFor="glucose-notes" className="block text-xs font-bold text-content mb-1">Notes (Optional)</label>
              <input
                id="glucose-notes"
                type="text"
                value={glucoseNotes}
                onChange={(e) => setGlucoseNotes(e.target.value)}
                placeholder="e.g. 2 hours after biryani, before breakfast"
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
          description="Record a new blood pressure reading."
          className="max-w-md"
        >
          <form onSubmit={handleSaveBp} className="space-y-4">
            {bpSaveError && <ErrorState compact message={bpSaveError} />}

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label htmlFor="bp-systolic" className="block text-xs font-bold text-content mb-1">Systolic (Top)</label>
                <input
                  id="bp-systolic"
                  type="number"
                  required
                  value={systolic}
                  onChange={(e) => setSystolic(e.target.value)}
                  placeholder="120"
                  className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-sm font-bold text-content focus:outline-accent"
                />
              </div>
              <div>
                <label htmlFor="bp-diastolic" className="block text-xs font-bold text-content mb-1">Diastolic (Bottom)</label>
                <input
                  id="bp-diastolic"
                  type="number"
                  required
                  value={diastolic}
                  onChange={(e) => setDiastolic(e.target.value)}
                  placeholder="80"
                  className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-sm font-bold text-content focus:outline-accent"
                />
              </div>
              <div>
                <label htmlFor="bp-pulse" className="block text-xs font-bold text-content mb-1">Pulse (bpm)</label>
                <input
                  id="bp-pulse"
                  type="number"
                  value={pulse}
                  onChange={(e) => setPulse(e.target.value)}
                  placeholder="72"
                  className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-sm font-bold text-content focus:outline-accent"
                />
              </div>
            </div>

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
                  className="h-10 text-xs font-bold"
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
                  className="h-10 text-xs font-bold"
                />
              </div>
            </div>

            <div>
              <label htmlFor="bp-notes" className="block text-xs font-bold text-content mb-1">Notes (Optional)</label>
              <input
                id="bp-notes"
                type="text"
                value={bpNotes}
                onChange={(e) => setBpNotes(e.target.value)}
                placeholder="e.g. Morning reading before coffee"
                className="w-full px-3 py-2 rounded-xl border border-line bg-surface text-xs text-content focus:outline-accent"
              />
            </div>

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
      </div>
    </AppShell>
  );
}
