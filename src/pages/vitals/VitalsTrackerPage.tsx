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

export function VitalsTrackerPage() {
  const { user, profile } = useAuth();
  const effectiveUserId = user?.id || profile?.user_id || '';
  const effectiveProfileId = profile?.id || effectiveUserId;

  const [activeTab, setActiveTab] = useState<'glucose' | 'bp'>('glucose');
  const [glucoseLogs, setGlucoseLogs] = useState<GlucoseReading[]>([]);
  const [bpLogs, setBpLogs] = useState<BloodPressureReading[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Glucose Entry Form State
  const [isGlucoseModalOpen, setIsGlucoseModalOpen] = useState(false);
  const [glucoseType, setGlucoseType] = useState<GlucoseType>('fasting');
  const [glucoseValue, setGlucoseValue] = useState('');
  const [glucoseUnit, setGlucoseUnit] = useState<'mg/dL' | 'mmol/L'>('mg/dL');
  const [glucoseNotes, setGlucoseNotes] = useState('');

  // Blood Pressure Entry Form State
  const [isBpModalOpen, setIsBpModalOpen] = useState(false);
  const [systolic, setSystolic] = useState('');
  const [diastolic, setDiastolic] = useState('');
  const [pulse, setPulse] = useState('');
  const [bpArm, setBpArm] = useState<'left' | 'right'>('left');
  const [bpPosture, setBpPosture] = useState<'sitting' | 'standing' | 'lying'>('sitting');
  const [bpNotes, setBpNotes] = useState('');

  const loadData = useCallback(async () => {
    if (!effectiveProfileId) return;
    setIsLoading(true);
    try {
      const [gData, bData] = await Promise.all([
        listGlucoseReadings(effectiveProfileId),
        listBloodPressureReadings(effectiveProfileId),
      ]);
      setGlucoseLogs(gData);
      setBpLogs(bData);
    } catch (err) {
      console.error('Failed to load vitals:', err);
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
    if (!glucoseValue || !effectiveUserId || !effectiveProfileId) return;

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

    await createGlucoseReading(newReading);
    setGlucoseValue('');
    setGlucoseNotes('');
    setIsGlucoseModalOpen(false);
    loadData();
  };

  // Handle BP Submission
  const handleSaveBp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!systolic || !diastolic || !effectiveUserId || !effectiveProfileId) return;

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

    await createBloodPressureReading(newReading);
    setSystolic('');
    setDiastolic('');
    setPulse('');
    setBpNotes('');
    setIsBpModalOpen(false);
    loadData();
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-ink-200/80 pb-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-ink-900 tracking-tight flex items-center gap-2">
              <span>Chronic Vitals Radar</span>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-800 border border-rose-200">
                Daily Tracker
              </span>
            </h1>
            <p className="text-xs sm:text-sm text-ink-600 mt-1">
              Precision logging and clinical target analytics for diabetes and hypertension management.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {activeTab === 'glucose' ? (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsGlucoseModalOpen(true)}
                className="bg-teal-800 hover:bg-teal-900"
              >
                + Log Blood Sugar
              </Button>
            ) : (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsBpModalOpen(true)}
                className="bg-rose-700 hover:bg-rose-800 text-white"
              >
                + Log Blood Pressure
              </Button>
            )}
          </div>
        </div>

        {/* Tab Toggle */}
        <div className="flex items-center gap-2 p-1 rounded-xl bg-ink-100/80 w-fit">
          <button
            type="button"
            onClick={() => setActiveTab('glucose')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'glucose'
                ? 'bg-white text-teal-950 shadow-xs'
                : 'text-ink-600 hover:text-ink-900'
            }`}
          >
            🩸 Blood Glucose ({glucoseLogs.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('bp')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'bp'
                ? 'bg-white text-rose-950 shadow-xs'
                : 'text-ink-600 hover:text-ink-900'
            }`}
          >
            🩺 Blood Pressure ({bpLogs.length})
          </button>
        </div>

        {/* 🩸 BLOOD GLUCOSE TAB */}
        {activeTab === 'glucose' && (
          <div className="space-y-6">
            {/* Stats Overview */}
            {glucoseStats && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-4 rounded-2xl bg-white border border-ink-200/90 shadow-2xs">
                  <p className="text-[10px] uppercase font-bold text-ink-500">Average Level</p>
                  <p className="text-xl font-black text-ink-900 mt-1">
                    {glucoseStats.avg} <span className="text-xs font-semibold text-ink-500">mg/dL</span>
                  </p>
                  <p className="text-[10px] text-ink-400 mt-0.5">({mgDlToMmol(glucoseStats.avg)} mmol/L)</p>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-ink-200/90 shadow-2xs">
                  <p className="text-[10px] uppercase font-bold text-ink-500">Target Adherence</p>
                  <p className="text-xl font-black text-emerald-700 mt-1">{glucoseStats.inRangePercent}%</p>
                  <p className="text-[10px] text-ink-400 mt-0.5">In ADA Target Zone</p>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-ink-200/90 shadow-2xs">
                  <p className="text-[10px] uppercase font-bold text-ink-500">Lowest Reading</p>
                  <p className="text-xl font-black text-ink-900 mt-1">{glucoseStats.min} mg/dL</p>
                  <p className="text-[10px] text-ink-400 mt-0.5">Past 30 days</p>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-ink-200/90 shadow-2xs">
                  <p className="text-[10px] uppercase font-bold text-ink-500">Peak Spike</p>
                  <p className="text-xl font-black text-rose-700 mt-1">{glucoseStats.max} mg/dL</p>
                  <p className="text-[10px] text-ink-400 mt-0.5">Past 30 days</p>
                </div>
              </div>
            )}

            {/* Glucose Logs List */}
            <div className="bg-white border border-ink-200/90 rounded-2xl overflow-hidden shadow-2xs">
              <div className="p-4 border-b border-ink-100 flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-ink-700">
                  Recent Blood Glucose Logs
                </h3>
                <span className="text-[11px] text-ink-500">{glucoseLogs.length} total entries</span>
              </div>

              {isLoading ? (
                <div className="p-8 text-center text-xs text-ink-400">Loading glucose history...</div>
              ) : glucoseLogs.length === 0 ? (
                <div className="p-8 text-center space-y-2">
                  <p className="text-xs text-ink-500">No blood glucose entries logged yet.</p>
                  <Button variant="secondary" size="sm" onClick={() => setIsGlucoseModalOpen(true)}>
                    + Log Your First Reading
                  </Button>
                </div>
              ) : (
                <div className="divide-y divide-ink-100">
                  {glucoseLogs.map((log) => {
                    const evalResult = evaluateGlucose(log.value_mg_dl, log.type);
                    return (
                      <div key={log.id} className="p-4 flex items-center justify-between gap-3 hover:bg-ink-50/50 transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-800 border border-teal-200/80 flex items-center justify-center font-bold text-xs shrink-0">
                            {log.value_mg_dl}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-bold text-ink-900 capitalize">
                                {log.type.replace('_', ' ')}
                              </span>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${evalResult.color}`}>
                                {evalResult.label}
                              </span>
                            </div>
                            <p className="text-[11px] text-ink-500 mt-0.5">
                              {new Date(log.measured_at).toLocaleDateString()} at {new Date(log.measured_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              {log.notes && ` • "${log.notes}"`}
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => log.id && deleteGlucoseReading(log.id).then(loadData)}
                          className="text-[11px] text-ink-400 hover:text-rose-700 p-1.5 rounded hover:bg-ink-100 transition-colors"
                          title="Delete entry"
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 🩺 BLOOD PRESSURE TAB */}
        {activeTab === 'bp' && (
          <div className="space-y-6">
            {/* Stats Overview */}
            {bpStats && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-4 rounded-2xl bg-white border border-ink-200/90 shadow-2xs">
                  <p className="text-[10px] uppercase font-bold text-ink-500">Average BP</p>
                  <p className="text-xl font-black text-ink-900 mt-1">
                    {bpStats.sysAvg}/{bpStats.diaAvg} <span className="text-xs font-semibold text-ink-500">mmHg</span>
                  </p>
                  <p className="text-[10px] text-ink-400 mt-0.5">30-day average</p>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-ink-200/90 shadow-2xs">
                  <p className="text-[10px] uppercase font-bold text-ink-500">Mean Arterial Pressure (MAP)</p>
                  <p className="text-xl font-black text-teal-800 mt-1">{bpStats.map} mmHg</p>
                  <p className="text-[10px] text-ink-400 mt-0.5">Organ perfusion index</p>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-ink-200/90 shadow-2xs">
                  <p className="text-[10px] uppercase font-bold text-ink-500">Normal Range</p>
                  <p className="text-xl font-black text-emerald-700 mt-1">{bpStats.normalPercent}%</p>
                  <p className="text-[10px] text-ink-400 mt-0.5">Optimal AHA readings</p>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-ink-200/90 shadow-2xs">
                  <p className="text-[10px] uppercase font-bold text-ink-500">Total Logs</p>
                  <p className="text-xl font-black text-ink-900 mt-1">{bpStats.total}</p>
                  <p className="text-[10px] text-ink-400 mt-0.5">Cardio log entries</p>
                </div>
              </div>
            )}

            {/* BP Logs List */}
            <div className="bg-white border border-ink-200/90 rounded-2xl overflow-hidden shadow-2xs">
              <div className="p-4 border-b border-ink-100 flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-ink-700">
                  Recent Blood Pressure Logs
                </h3>
                <span className="text-[11px] text-ink-500">{bpLogs.length} total entries</span>
              </div>

              {isLoading ? (
                <div className="p-8 text-center text-xs text-ink-400">Loading blood pressure history...</div>
              ) : bpLogs.length === 0 ? (
                <div className="p-8 text-center space-y-2">
                  <p className="text-xs text-ink-500">No blood pressure logs recorded yet.</p>
                  <Button variant="secondary" size="sm" onClick={() => setIsBpModalOpen(true)}>
                    + Log Your First BP Reading
                  </Button>
                </div>
              ) : (
                <div className="divide-y divide-ink-100">
                  {bpLogs.map((log) => {
                    const evalResult = evaluateBloodPressure(log.systolic, log.diastolic);
                    return (
                      <div key={log.id} className="p-4 flex items-center justify-between gap-3 hover:bg-ink-50/50 transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-12 h-10 rounded-xl bg-rose-50 text-rose-800 border border-rose-200/80 flex items-center justify-center font-bold text-xs shrink-0">
                            {log.systolic}/{log.diastolic}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${evalResult.badgeBg}`}>
                                {evalResult.label}
                              </span>
                              {log.pulse_bpm && (
                                <span className="text-[11px] font-semibold text-rose-900 bg-rose-50/80 px-2 py-0.5 rounded border border-rose-100">
                                  ❤️ {log.pulse_bpm} bpm
                                </span>
                              )}
                              {log.arm && (
                                <span className="text-[10px] text-ink-500 capitalize">
                                  {log.arm} arm • {log.posture || 'sitting'}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-ink-500 mt-0.5">
                              {new Date(log.measured_at).toLocaleDateString()} at {new Date(log.measured_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              {log.notes && ` • "${log.notes}"`}
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => log.id && deleteBloodPressureReading(log.id).then(loadData)}
                          className="text-[11px] text-ink-400 hover:text-rose-700 p-1.5 rounded hover:bg-ink-100 transition-colors"
                          title="Delete entry"
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 📝 GLUCOSE MODAL */}
        {isGlucoseModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between border-b border-ink-100 pb-3">
                <h3 className="text-base font-bold text-ink-900">Log Blood Glucose</h3>
                <button
                  type="button"
                  onClick={() => setIsGlucoseModalOpen(false)}
                  className="text-ink-400 hover:text-ink-700 text-sm font-bold"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveGlucose} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-ink-700 mb-1">Measurement Type</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['fasting', 'post_prandial', 'random', 'bedtime'] as GlucoseType[]).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setGlucoseType(t)}
                        className={`py-2 px-3 rounded-xl text-xs font-bold capitalize transition-colors border ${
                          glucoseType === t
                            ? 'bg-teal-50 border-teal-600 text-teal-900'
                            : 'bg-white border-ink-200 text-ink-600 hover:bg-ink-50'
                        }`}
                      >
                        {t.replace('_', ' ')}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-ink-700 mb-1">Glucose Reading</label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={glucoseValue}
                      onChange={(e) => setGlucoseValue(e.target.value)}
                      placeholder={glucoseUnit === 'mg/dL' ? 'e.g. 95' : 'e.g. 5.3'}
                      className="w-full px-3 py-2 rounded-xl border border-ink-200 text-sm font-bold text-ink-900 focus:outline-teal-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-ink-700 mb-1">Unit</label>
                    <select
                      value={glucoseUnit}
                      onChange={(e) => setGlucoseUnit(e.target.value as any)}
                      className="w-full px-2 py-2 rounded-xl border border-ink-200 text-xs font-bold text-ink-900 bg-white"
                    >
                      <option value="mg/dL">mg/dL</option>
                      <option value="mmol/L">mmol/L</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-ink-700 mb-1">Notes (Optional)</label>
                  <input
                    type="text"
                    value={glucoseNotes}
                    onChange={(e) => setGlucoseNotes(e.target.value)}
                    placeholder="e.g. 2 hours after biryani, before breakfast"
                    className="w-full px-3 py-2 rounded-xl border border-ink-200 text-xs text-ink-900 focus:outline-teal-600"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <Button variant="secondary" size="sm" type="button" onClick={() => setIsGlucoseModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button variant="primary" size="sm" type="submit">
                    Save Reading
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* 📝 BP MODAL */}
        {isBpModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between border-b border-ink-100 pb-3">
                <h3 className="text-base font-bold text-ink-900">Log Blood Pressure</h3>
                <button
                  type="button"
                  onClick={() => setIsBpModalOpen(false)}
                  className="text-ink-400 hover:text-ink-700 text-sm font-bold"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveBp} className="space-y-4">
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-ink-700 mb-1">Systolic (Top)</label>
                    <input
                      type="number"
                      required
                      value={systolic}
                      onChange={(e) => setSystolic(e.target.value)}
                      placeholder="120"
                      className="w-full px-3 py-2 rounded-xl border border-ink-200 text-sm font-bold text-ink-900 focus:outline-rose-600"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-ink-700 mb-1">Diastolic (Bottom)</label>
                    <input
                      type="number"
                      required
                      value={diastolic}
                      onChange={(e) => setDiastolic(e.target.value)}
                      placeholder="80"
                      className="w-full px-3 py-2 rounded-xl border border-ink-200 text-sm font-bold text-ink-900 focus:outline-rose-600"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-ink-700 mb-1">Pulse (bpm)</label>
                    <input
                      type="number"
                      value={pulse}
                      onChange={(e) => setPulse(e.target.value)}
                      placeholder="72"
                      className="w-full px-3 py-2 rounded-xl border border-ink-200 text-sm font-bold text-ink-900 focus:outline-rose-600"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-bold text-ink-700 mb-1">Arm</label>
                    <select
                      value={bpArm}
                      onChange={(e) => setBpArm(e.target.value as any)}
                      className="w-full px-3 py-2 rounded-xl border border-ink-200 text-xs font-bold text-ink-900 bg-white"
                    >
                      <option value="left">Left Arm</option>
                      <option value="right">Right Arm</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-ink-700 mb-1">Posture</label>
                    <select
                      value={bpPosture}
                      onChange={(e) => setBpPosture(e.target.value as any)}
                      className="w-full px-3 py-2 rounded-xl border border-ink-200 text-xs font-bold text-ink-900 bg-white"
                    >
                      <option value="sitting">Sitting</option>
                      <option value="standing">Standing</option>
                      <option value="lying">Lying Down</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-ink-700 mb-1">Notes (Optional)</label>
                  <input
                    type="text"
                    value={bpNotes}
                    onChange={(e) => setBpNotes(e.target.value)}
                    placeholder="e.g. Morning reading before coffee"
                    className="w-full px-3 py-2 rounded-xl border border-ink-200 text-xs text-ink-900 focus:outline-rose-600"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <Button variant="secondary" size="sm" type="button" onClick={() => setIsBpModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button variant="primary" size="sm" type="submit" className="bg-rose-700 hover:bg-rose-800 text-white">
                    Save BP Log
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
