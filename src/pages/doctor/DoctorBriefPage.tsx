import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { AppShell } from '../../components/layout/AppShell';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Skeleton } from '../../components/ui/Skeleton';
import {
  MedicineIcon,
  StethoscopeIcon,
  LabFlaskIcon,
} from '../../components/ui/icons';
import { activeMedicines, recentlyFinishedMedicines } from '../../domain/activeMedicines';
import { todayInAppTz } from '../../lib/time';
import { useAuth } from '../../lib/auth/AuthContext';
import { medicinesRepo, profilesRepo, visitsRepo, reportsRepo } from '../../lib/db';
import type { Tables } from '../../lib/supabase/types';

export function DoctorBriefPage() {
  const { user, profile: authProfile } = useAuth();
  const [profile, setProfile] = useState<Tables<'profiles'> | null>(null);
  const [medicines, setMedicines] = useState<Tables<'medicines'>[]>([]);
  const [recentVisits, setRecentVisits] = useState<Tables<'visits'>[]>([]);
  const [recentReports, setRecentReports] = useState<Tables<'reports'>[]>([]);
  const [reportResults, setReportResults] = useState<Record<string, Tables<'report_results'>[]>>({});
  const [isLoading, setIsLoading] = useState(true);

  const effectiveUserId = user?.id || authProfile?.user_id || '';
  const effectiveProfileId = authProfile?.id || effectiveUserId;
  const today = todayInAppTz();

  useEffect(() => {
    async function loadData() {
      if (!effectiveUserId) return;
      setIsLoading(true);
      try {
        const [p, meds, visits, reports] = await Promise.all([
          profilesRepo.getDefaultProfile(effectiveUserId),
          medicinesRepo.listMedicines(effectiveProfileId),
          visitsRepo.listVisits(effectiveProfileId),
          reportsRepo.listReports(effectiveProfileId),
        ]);

        setProfile(p);
        setMedicines(meds);
        setRecentVisits(visits.slice(0, 4));
        setRecentReports(reports.slice(0, 4));

        const resultsMap: Record<string, Tables<'report_results'>[]> = {};
        await Promise.all(
          reports.slice(0, 4).map(async (r) => {
            const res = await reportsRepo.listResultsForReport(r.id);
            resultsMap[r.id] = res;
          })
        );
        setReportResults(resultsMap);
      } catch (err) {
        console.error('Failed to load doctor brief data:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [effectiveUserId, effectiveProfileId]);

  const currentlyTaking = useMemo(() => {
    return activeMedicines(medicines, today);
  }, [medicines, today]);

  const recentlyFinished = useMemo(() => {
    return recentlyFinishedMedicines(medicines, today, 30);
  }, [medicines, today]);

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <AppShell>
        <div className="space-y-6 max-w-4xl mx-auto">
          <Skeleton className="h-10 w-1/3" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </AppShell>
    );
  }

  const allergies: string[] = profile?.allergies
    ? Array.isArray(profile.allergies)
      ? (profile.allergies as string[])
      : String(profile.allergies).split(',').map((s) => s.trim())
    : ['None recorded'];

  const conditions: string[] = profile?.chronic_conditions
    ? Array.isArray(profile.chronic_conditions)
      ? (profile.chronic_conditions as string[])
      : String(profile.chronic_conditions).split(',').map((s) => s.trim())
    : ['None recorded'];

  return (
    <AppShell>
      {/* Header hidden on print */}
      <div className="print:hidden">
        <PageHeader
          title="Printable Doctor Brief & Clinical Dossier"
          description="A concise, high-density clinical summary formatted for your consulting doctor or hospital triage."
          action={
            <div className="flex items-center gap-3">
              <Link to="/share">
                <Button variant="secondary">Digital Share Link</Button>
              </Link>
              <Button variant="primary" onClick={handlePrint} className="font-bold shadow-xs">
                🖨️ Export Clinical Dossier (PDF / Print)
              </Button>
            </div>
          }
        />
      </div>

      {/* Printable Clinical Sheet (A4 Layout) */}
      <div className="max-w-4xl mx-auto bg-white border border-ink-200 rounded-[var(--radius-lg)] p-6 sm:p-8 shadow-sm print:border-0 print:p-0 print:shadow-none space-y-6 print:space-y-4">
        {/* Patient Clinical Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b-2 border-ink-900 gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-ink-900 tracking-tight">
                {profile?.full_name || 'Patient Health Dossier'}
              </h1>
              <span className="text-xs px-2 py-0.5 rounded bg-teal-100 text-teal-900 font-bold">
                Medfolio Clinical Record
              </span>
            </div>
            <p className="text-xs text-ink-600 mt-1">
              Generated on {today} • Karachi Standard Time (PKT)
            </p>
          </div>

          <div className="flex flex-wrap gap-3 text-xs sm:text-right">
            <div>
              <span className="text-ink-500 block">Biological Sex:</span>
              <span className="font-bold text-ink-900 capitalize">{profile?.sex || 'Unspecified'}</span>
            </div>
            {profile?.date_of_birth && (
              <div>
                <span className="text-ink-500 block">DOB:</span>
                <span className="font-bold text-ink-900">{profile.date_of_birth}</span>
              </div>
            )}
            {profile?.blood_group && (
              <div>
                <span className="text-ink-500 block">Blood Group:</span>
                <span className="font-bold text-red-700">{profile.blood_group}</span>
              </div>
            )}
          </div>
        </div>

        {/* High-Alert Clinical Flags: Allergies & Chronic Conditions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl border border-red-200 bg-red-50/50 print:p-3">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-red-900 block mb-1.5 flex items-center gap-1.5">
              <span>⚠️ Known Drug & Food Allergies</span>
            </span>
            <div className="flex flex-wrap gap-1.5">
              {allergies.map((all, idx) => (
                <span
                  key={idx}
                  className="text-xs font-bold px-2 py-0.5 rounded bg-red-100 text-red-900 border border-red-300"
                >
                  {all}
                </span>
              ))}
            </div>
          </div>

          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-ink-900 block mb-1.5">
              Chronic Medical Conditions
            </span>
            <div className="flex flex-wrap gap-1.5">
              {conditions.map((cond, idx) => (
                <span
                  key={idx}
                  className="text-xs font-semibold px-2 py-0.5 rounded bg-ink-100 text-ink-800 border border-ink-200"
                >
                  {cond}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Currently Taking Medicines (Authoritative Active Courses Only) */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-ink-900 flex items-center gap-2">
              <MedicineIcon size={16} className="text-teal-700" />
              Currently Prescribed Medicines ({currentlyTaking.length})
            </h2>
            <span className="text-xs text-ink-500 italic">Deduplicated active courses</span>
          </div>

          {currentlyTaking.length === 0 ? (
            <p className="text-xs text-ink-500 italic p-3 border border-ink-100 rounded bg-ink-50">
              No active medications currently prescribed.
            </p>
          ) : (
            <div className="border border-ink-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-ink-100/80 text-ink-700 font-bold border-b border-ink-200">
                    <th className="p-2.5">Medication & Strength</th>
                    <th className="p-2.5">Dose Amount</th>
                    <th className="p-2.5">Frequency & Timing</th>
                    <th className="p-2.5">Meal Relation</th>
                    <th className="p-2.5">Course / Duration</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {currentlyTaking.map((med) => (
                    <tr key={med.id} className="hover:bg-ink-50/50">
                      <td className="p-2.5 font-bold text-ink-900">
                        {med.medicine_name} {med.strength || ''}
                        {med.form ? <span className="text-ink-500 font-normal"> ({med.form})</span> : ''}
                      </td>
                      <td className="p-2.5 text-ink-800">{med.dose_amount || '1 tablet'}</td>
                      <td className="p-2.5 font-semibold text-teal-900">
                        {med.frequency_code || med.frequency_raw || 'OD'}
                      </td>
                      <td className="p-2.5 text-ink-700">
                        {med.with_food ? 'With food' : 'Empty stomach'}
                      </td>
                      <td className="p-2.5 text-ink-600">
                        {med.is_ongoing ? (
                          <Badge tone="info" size="sm">Ongoing</Badge>
                        ) : med.duration_days ? (
                          `${med.duration_days} days (started ${med.start_date})`
                        ) : (
                          `Started ${med.start_date}`
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Recently Finished Courses (< 30 Days) */}
        {recentlyFinished.length > 0 && (
          <section className="space-y-2 pt-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-ink-600">
              Recently Completed Courses (Last 30 Days)
            </h3>
            <div className="flex flex-wrap gap-2 text-xs">
              {recentlyFinished.map((med) => (
                <div
                  key={med.id}
                  className="px-2.5 py-1 rounded-lg border border-ink-200 bg-ink-50 text-ink-700"
                >
                  <span className="font-semibold">{med.medicine_name} {med.strength || ''}</span>
                  <span className="text-ink-400 ml-1.5">
                    (Ended {med.end_date || med.discontinued_at?.slice(0, 10)})
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Multi-Parameter Biomarker & Diagnostic Correlation Grid */}
        <section className="space-y-3 pt-2">
          <h2 className="text-sm font-bold uppercase tracking-wider text-ink-900 flex items-center gap-2">
            <LabFlaskIcon size={16} className="text-blue-700" />
            Diagnostic Lab Biomarker History & Ranges
          </h2>

          {recentReports.length === 0 ? (
            <p className="text-xs text-ink-400 italic">No lab reports recorded.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {recentReports.map((r) => {
                const results = reportResults[r.id] || [];
                return (
                  <div key={r.id} className="p-3 rounded-xl border border-ink-200 bg-ink-50/50 space-y-2 text-xs">
                    <div className="flex items-center justify-between font-bold text-ink-900 border-b border-ink-200 pb-1.5">
                      <span>{r.title}</span>
                      <span className="text-ink-500 text-[11px] font-normal">{r.report_date}</span>
                    </div>

                    {results.length > 0 ? (
                      <div className="space-y-1">
                        {results.slice(0, 4).map((res, resIdx) => {
                          const isAbnormal = res.range_status === 'above' || res.range_status === 'below';
                          return (
                            <div key={resIdx} className="flex items-center justify-between text-[11px]">
                              <span className="text-ink-700 font-medium">{res.test_name}:</span>
                              <div className="flex items-center gap-1.5">
                                <span className={`font-bold ${isAbnormal ? 'text-red-700 font-black' : 'text-ink-900'}`}>
                                  {res.value_text} {res.unit || ''}
                                </span>
                                {res.range_status && (
                                  <Badge tone={isAbnormal ? 'risk' : 'ok'} size="sm">
                                    {res.range_status.toUpperCase()}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-[11px] text-ink-400 italic">No biomarker parameters parsed</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Recent Doctor Visits */}
        <section className="space-y-3 pt-2">
          <h2 className="text-sm font-bold uppercase tracking-wider text-ink-900 flex items-center gap-2">
            <StethoscopeIcon size={16} className="text-teal-700" />
            Recent Clinical Visits & Consultations
          </h2>

          {recentVisits.length === 0 ? (
            <p className="text-xs text-ink-400 italic">No previous visits recorded.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {recentVisits.map((v) => (
                <div key={v.id} className="p-3 rounded-xl border border-ink-200 bg-white space-y-1 text-xs">
                  <div className="flex items-center justify-between font-bold text-ink-900">
                    <span>Dr. {v.doctor_name || 'Physician'}</span>
                    <span className="text-ink-500 font-normal">{v.visit_date}</span>
                  </div>
                  {v.clinic_name && <p className="text-ink-600 text-[11px]">{v.clinic_name}</p>}
                  {v.diagnosis && (
                    <p className="text-teal-900 font-semibold text-[11px]">Diagnosis: {v.diagnosis}</p>
                  )}
                  {v.doctor_advice && (
                    <p className="text-ink-700 text-[11px]">Advice: {v.doctor_advice}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Footer Clinical Disclaimer */}
        <div className="pt-4 border-t border-ink-200 text-[10px] text-ink-500 leading-relaxed">
          <p>
            Note: This clinical dossier is generated by Medfolio from verified patient records and diagnostic laboratory OCR. Intended for consulting physicians and emergency healthcare providers.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
