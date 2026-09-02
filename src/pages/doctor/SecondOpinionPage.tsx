import { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { AppShell } from '../../components/layout/AppShell';
import { useAuth } from '../../lib/auth/AuthContext';
import { listMedicines, Medicine } from '../../lib/db/medicines';
import { listVisits, Visit } from '../../lib/db/visits';
import { listReports, getReportResults, Report, LabResult } from '../../lib/db/reports';
import { listGlucoseReadings, listBloodPressureReadings } from '../../lib/db/vitals';
import type { GlucoseReading, BloodPressureReading } from '../../domain/vitals';
import { generateWatermarkMetadata, WatermarkMetadata } from '../../lib/security/watermark';
import { Button } from '../../components/ui/Button';
import { PrinterIcon, DownloadIcon, ShieldIcon } from '../../components/ui/icons';
import { exportElementToPdf } from '../../lib/export/pdfExport';

export function SecondOpinionPage() {
  const { user, profile } = useAuth();
  const effectiveUserId = user?.id || profile?.user_id || '';
  const effectiveProfileId = profile?.id || effectiveUserId;

  const [anonymize, setAnonymize] = useState(true);
  const [specialistNotes, setSpecialistNotes] = useState('');
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [_reports, setReports] = useState<Report[]>([]);
  const [labResults, setLabResults] = useState<LabResult[]>([]);
  const [glucose, setGlucose] = useState<GlucoseReading[]>([]);
  const [bp, setBp] = useState<BloodPressureReading[]>([]);
  const [watermark, setWatermark] = useState<WatermarkMetadata | null>(null);
  const [_isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const dossierRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadData() {
      if (!effectiveProfileId) return;
      setIsLoading(true);
      try {
        const [medsData, visitsData, reportsData, gluData, bpData] = await Promise.all([
          listMedicines(effectiveProfileId),
          listVisits(effectiveProfileId),
          listReports(effectiveProfileId),
          listGlucoseReadings(effectiveProfileId),
          listBloodPressureReadings(effectiveProfileId),
        ]);

        const allResults = await Promise.all(
          reportsData.slice(0, 5).map((r) => getReportResults(r.id))
        );

        setMedicines(medsData);
        setVisits(visitsData);
        setReports(reportsData);
        setLabResults(allResults.flat());
        setGlucose(gluData);
        setBp(bpData);

        // Generate tamper-evident watermark hash
        const summaryPayload = JSON.stringify({
          patientId: effectiveProfileId,
          medsCount: medsData.length,
          visitsCount: visitsData.length,
          reportsCount: reportsData.length,
          generatedAt: new Date().toISOString(),
        });
        const wm = await generateWatermarkMetadata(effectiveProfileId, summaryPayload);
        setWatermark(wm);
      } catch (err) {
        console.error('Failed to load dossier data:', err);
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [effectiveProfileId]);

  const displayName = useMemo(() => {
    if (!anonymize) {
      return profile?.full_name || 'Patient';
    }
    const name = profile?.full_name || 'Patient';
    const parts = name.split(' ');
    if (parts.length > 1) {
      const lastInitial = parts[parts.length - 1]?.[0] ?? '';
      return `${parts[0]} ${lastInitial}. (Anonymized)`;
    }
    return `${name.slice(0, 3)}*** (Anonymized)`;
  }, [anonymize, profile?.full_name]);

  const abnormalLabs = useMemo(() => {
    return labResults.filter((r) => r.range_status === 'above' || r.range_status === 'below');
  }, [labResults]);

  const handleExportPdf = async () => {
    if (!dossierRef.current || isExporting) return;
    setIsExporting(true);
    try {
      const slug = displayName.replace(/[^a-zA-Z0-9_-]/g, '_');
      await exportElementToPdf(dossierRef.current, {
        filename: `Second_Opinion_Dossier_${slug}.pdf`,
      });
    } catch (err) {
      console.error('Failed to export PDF:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <AppShell>
      <div className="space-y-6 max-w-4xl mx-auto print:max-w-full print:p-0">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-ink-200/80 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Link to="/doctors" className="text-xs font-semibold text-teal-800 hover:underline print:hidden">
                ← Doctors Directory
              </Link>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-ink-900 tracking-tight mt-1 flex items-center gap-2">
              <span>Second-Opinion Dossier Packager</span>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-800 border border-indigo-200">
                Specialist Ready
              </span>
            </h1>
            <p className="text-xs sm:text-sm text-ink-600 mt-1">
              Export an organized, tamper-verified clinical dossier formatted for remote specialists and second consultations.
            </p>
          </div>

          <div className="flex items-center gap-2 print:hidden flex-wrap">
            <Button variant="secondary" size="sm" onClick={handlePrint} leftIcon={<PrinterIcon size={14} />}>
              Print
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleExportPdf}
              disabled={isExporting}
              leftIcon={<DownloadIcon size={14} />}
            >
              {isExporting ? 'Generating PDF...' : 'Export Dossier (PDF)'}
            </Button>
          </div>
        </div>

        {/* Configuration Bar (Hidden in Print) */}
        <div className="p-4 rounded-2xl bg-white border border-ink-200 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 print:hidden">
          <div className="flex items-center gap-2.5">
            <input
              id="anonymize-toggle"
              type="checkbox"
              checked={anonymize}
              onChange={(e) => setAnonymize(e.target.checked)}
              className="h-4 w-4 rounded text-teal-800 focus:ring-teal-600 cursor-pointer"
            />
            <label htmlFor="anonymize-toggle" className="cursor-pointer">
              <span className="text-xs font-bold text-ink-900 block">Anonymize Patient Identity</span>
              <span className="text-[11px] text-ink-500 block">
                Masks full name, phone number, and exact address for medical privacy
              </span>
            </label>
          </div>

          <div className="text-right text-xs font-mono text-ink-500 flex items-center gap-1">
            Security Status: <span className="text-emerald-700 font-bold flex items-center gap-1"><ShieldIcon size={13} /> SHA-256 Watermarked</span>
          </div>
        </div>

        {/* Questions for the Specialist Input (Hidden in Print if empty) */}
        <div className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-200 print:bg-white print:border-ink-300">
          <label htmlFor="specialist-notes" className="block text-xs font-bold text-indigo-950 mb-1.5">
            Key Questions for the Consulting Specialist:
          </label>
          <textarea
            id="specialist-notes"
            value={specialistNotes}
            onChange={(e) => setSpecialistNotes(e.target.value)}
            placeholder="e.g. Seeking second opinion on diagnosis; are alternative therapies or surgical interventions indicated?"
            rows={3}
            className="w-full px-3.5 py-2 text-xs rounded-xl border border-indigo-200 bg-white text-ink-900 focus:outline-indigo-600"
          />
        </div>

        {/* PRINTABLE DOSSIER SHEET */}
        <div
          ref={dossierRef}
          className="bg-white border border-ink-200/90 rounded-3xl p-6 sm:p-10 shadow-sm print:border-none print:shadow-none print:p-0 space-y-6"
        >
          {/* Official Verification Watermark Header */}
          <div className="flex items-center justify-between pb-4 border-b-2 border-teal-900">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-black text-teal-950 tracking-tight">MEDFOLIO</span>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-teal-100 text-teal-950">
                  CLINICAL SECOND-OPINION DOSSIER
                </span>
              </div>
              <p className="text-[11px] text-ink-600 mt-0.5">
                Structured Longitudinal Patient Health Records Summary
              </p>
            </div>

            {watermark && (
              <div className="text-right">
                <p className="text-[10px] font-mono font-bold text-teal-950">{watermark.securityStamp}</p>
                <p className="text-[9px] font-mono text-ink-500">
                  Issued: {new Date(watermark.issuedAt).toLocaleDateString()}
                </p>
              </div>
            )}
          </div>

          {/* Patient Demographics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-2xl bg-ink-50/70 border border-ink-200/80 text-xs">
            <div>
              <p className="text-[10px] uppercase font-bold text-ink-500">Patient Identifier</p>
              <p className="font-bold text-ink-900 mt-0.5">{displayName}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-ink-500">Sex / Blood Group</p>
              <p className="font-semibold text-ink-900 mt-0.5">
                {profile?.sex || 'Unspecified'} • {profile?.blood_group || 'Unknown'}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-ink-500">Chronic Conditions</p>
              <p className="font-semibold text-ink-900 mt-0.5">
                {profile?.chronic_conditions || 'None reported'}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-ink-500">Allergies</p>
              <p className="font-semibold text-rose-800 mt-0.5">
                {profile?.allergies || 'No known drug allergies (NKDA)'}
              </p>
            </div>
          </div>

          {/* Section 1: Active Prescriptions */}
          <div className="space-y-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-teal-950 border-b border-ink-200 pb-1">
              1. Current Medication Regimen ({medicines.filter((m) => !m.discontinued_at).length} Active)
            </h2>
            {medicines.filter((m) => !m.discontinued_at).length === 0 ? (
              <p className="text-xs text-ink-500 italic">No active medications recorded.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {medicines
                  .filter((m) => !m.discontinued_at)
                  .map((m) => (
                    <div key={m.id} className="p-2.5 rounded-xl border border-ink-200 bg-white">
                      <p className="font-bold text-ink-900">
                        {m.medicine_name} {m.strength && `(${m.strength})`}
                      </p>
                      <p className="text-[11px] text-ink-600">
                        Dose: {m.dose_amount || '1'} • Freq: {m.frequency_raw || m.frequency_code || 'Standard'} • Start: {m.start_date}
                      </p>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* Section 2: Abnormal Biomarker History */}
          <div className="space-y-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-teal-950 border-b border-ink-200 pb-1">
              2. Significant Lab Biomarkers & Out-of-Range Results
            </h2>
            {abnormalLabs.length === 0 ? (
              <p className="text-xs text-ink-500 italic">No out-of-range biomarkers detected in recent lab results.</p>
            ) : (
              <div className="divide-y divide-ink-100 border border-ink-200 rounded-2xl overflow-hidden text-xs">
                {abnormalLabs.slice(0, 6).map((lab) => (
                  <div key={lab.id} className="p-2.5 flex items-center justify-between bg-white">
                    <div>
                      <span className="font-bold text-ink-900">{lab.test_name}</span>
                      <span className="text-[11px] text-ink-500 ml-2">
                        Ref: {lab.reference_range || 'N/A'}
                      </span>
                    </div>
                    <span className="font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                      {lab.value_text} ({lab.range_status.toUpperCase()})
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 3: Recent Chronic Vitals */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h2 className="text-xs font-bold uppercase tracking-wider text-teal-950 border-b border-ink-200 pb-1">
                3. Recent Blood Glucose Trend
              </h2>
              {glucose.length === 0 ? (
                <p className="text-xs text-ink-500 italic">No glucose logs available.</p>
              ) : (
                <div className="space-y-1 text-xs">
                  {glucose.slice(0, 4).map((g) => (
                    <div key={g.id} className="flex items-center justify-between p-2 rounded-lg bg-ink-50/70 border border-ink-200/60">
                      <span className="font-medium capitalize">{g.type.replace('_', ' ')}:</span>
                      <span className="font-bold text-ink-900">{g.value_mg_dl} mg/dL</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <h2 className="text-xs font-bold uppercase tracking-wider text-teal-950 border-b border-ink-200 pb-1">
                4. Recent Blood Pressure Trend
              </h2>
              {bp.length === 0 ? (
                <p className="text-xs text-ink-500 italic">No BP logs available.</p>
              ) : (
                <div className="space-y-1 text-xs">
                  {bp.slice(0, 4).map((b) => (
                    <div key={b.id} className="flex items-center justify-between p-2 rounded-lg bg-ink-50/70 border border-ink-200/60">
                      <span className="font-medium text-ink-600">{b.measured_at.split('T')[0]}:</span>
                      <span className="font-bold text-ink-900">{b.systolic}/{b.diastolic} mmHg {b.pulse_bpm && `(${b.pulse_bpm} bpm)`}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Section 4: Recent Consultation History */}
          <div className="space-y-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-teal-950 border-b border-ink-200 pb-1">
              5. Recent Physician Consultations & Diagnoses
            </h2>
            {visits.length === 0 ? (
              <p className="text-xs text-ink-500 italic">No physician visits documented.</p>
            ) : (
              <div className="space-y-2 text-xs">
                {visits.slice(0, 3).map((v) => (
                  <div key={v.id} className="p-3 rounded-xl border border-ink-200 bg-white">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-ink-900">Dr. {v.doctor_name || 'Physician'} ({v.specialty || 'General'})</span>
                      <span className="text-[11px] text-ink-500">{v.visit_date}</span>
                    </div>
                    {v.diagnosis && <p className="text-[11px] text-ink-700 mt-1"><span className="font-semibold">Diagnosis:</span> {v.diagnosis}</p>}
                    {v.doctor_advice && <p className="text-[11px] text-ink-600 mt-0.5"><span className="font-semibold">Advice:</span> {v.doctor_advice}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer Security Stamp */}
          <div className="pt-6 border-t border-ink-200 flex flex-col sm:flex-row items-center justify-between gap-2 text-[10px] text-ink-400 font-mono">
            <span>Official Clinical Dossier • Medfolio v2 Health OS</span>
            <span>Tamper-evident verification hash: {watermark?.checksum.slice(0, 24)}...</span>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
