import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { sharesRepo } from '../../lib/db';
import { activeMedicines } from '../../domain/activeMedicines';
import { mealRelationLabel } from '../../domain/mealRelation';
import { todayInAppTz } from '../../lib/time';
import { MedicineIcon, StethoscopeIcon } from '../../components/ui/icons';
import type { Tables } from '../../lib/supabase/types';

export function PublicShareView() {
  const { token } = useParams<{ token: string }>();

  const [isLoading, setIsLoading] = useState(true);
  const [isInvalid, setIsInvalid] = useState(false);
  const [invalidReason, setInvalidReason] = useState<string>('');

  const [profile, setProfile] = useState<Tables<'profiles'> | null>(null);
  const [medicines, setMedicines] = useState<Tables<'medicines'>[]>([]);
  const [visits, setVisits] = useState<Tables<'visits'>[]>([]);

  const today = todayInAppTz();

  useEffect(() => {
    async function loadSharedRecord() {
      if (!token) {
        setIsInvalid(true);
        setInvalidReason('No share token provided.');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        // Single security-definer call: it hashes the token server-side and
        // returns only the records this link authorises. Unknown, revoked and
        // expired tokens are indistinguishable by design.
        const brief = await sharesRepo.fetchSharedBrief(token);

        if (!brief) {
          setIsInvalid(true);
          setInvalidReason('This share link is invalid, has been revoked, or has expired.');
          return;
        }

        setProfile(brief.profile);
        setMedicines(brief.medicines);
        setVisits(brief.visits);
      } catch (err) {
        console.error('Failed to load shared record:', err);
        setIsInvalid(true);
        setInvalidReason('Failed to load clinical brief. Please check your connection.');
      } finally {
        setIsLoading(false);
      }
    }

    loadSharedRecord();
  }, [token]);

  const activeMeds = useMemo(() => {
    return activeMedicines(medicines, today);
  }, [medicines, today]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-ink-50 flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-3 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-semibold text-ink-700">Loading Clinical Brief...</p>
        </div>
      </div>
    );
  }

  if (isInvalid) {
    return (
      <div className="min-h-screen bg-ink-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white p-8 rounded-2xl border border-ink-200 shadow-sm text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center mx-auto text-xl font-bold">
            !
          </div>
          <h1 className="text-lg font-bold text-ink-900">Link No Longer Available</h1>
          <p className="text-xs text-ink-600 leading-relaxed">{invalidReason}</p>
          <p className="text-[11px] text-ink-400">
            Please ask the patient to generate a new share link or QR code from their Medfolio application.
          </p>
        </div>
      </div>
    );
  }

  // Both columns are free-text; split on commas for display and drop blanks so
  // a trailing comma does not render an empty chip.
  const splitList = (value: string | null | undefined): string[] => {
    const parts = (value ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    return parts.length > 0 ? parts : ['None recorded'];
  };

  const allergies = splitList(profile?.allergies);
  const conditions = splitList(profile?.chronic_conditions);

  return (
    <div className="min-h-screen bg-ink-50 py-8 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto bg-white border border-ink-200 rounded-2xl shadow-sm p-6 sm:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-6 border-b border-ink-200 gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-ink-900">
                {profile?.full_name || 'Patient Health Brief'}
              </h1>
              <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-teal-100 text-teal-800 font-bold">
                Doctor View
              </span>
            </div>
            <p className="text-xs text-ink-500 mt-1">
              Active Medical Brief • Verified on {today}
            </p>
          </div>

          <button
            type="button"
            onClick={() => window.print()}
            className="text-xs font-bold px-3 py-1.5 rounded-md border border-ink-200 bg-ink-50 hover:bg-ink-100 text-ink-800"
          >
            Print Sheet (A4)
          </button>
        </div>

        {/* High Risk Flags */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl border border-red-200 bg-red-50/50 text-xs">
          <div>
            <span className="font-bold text-red-900 uppercase tracking-wider block mb-1.5">
              ⚠️ Allergies
            </span>
            <div className="flex flex-wrap gap-1.5">
              {allergies.map((all, idx) => (
                <span key={idx} className="font-bold px-2 py-0.5 rounded bg-red-100 text-red-900 border border-red-300">
                  {all}
                </span>
              ))}
            </div>
          </div>

          <div>
            <span className="font-bold text-ink-900 uppercase tracking-wider block mb-1.5">
              Chronic Conditions
            </span>
            <div className="flex flex-wrap gap-1.5">
              {conditions.map((cond, idx) => (
                <span key={idx} className="font-semibold px-2 py-0.5 rounded bg-ink-100 text-ink-800 border border-ink-200">
                  {cond}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Currently Taking Medicines */}
        <div className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-ink-900 flex items-center gap-2">
            <MedicineIcon size={16} className="text-teal-700" />
            Currently Active Medications ({activeMeds.length})
          </h2>

          {activeMeds.length === 0 ? (
            <p className="text-xs text-ink-500 italic p-3 border border-ink-100 rounded-lg bg-ink-50">
              No active medicines recorded.
            </p>
          ) : (
            <div className="border border-ink-200 rounded-xl overflow-hidden text-xs">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-ink-100 text-ink-700 font-bold border-b border-ink-200">
                    <th className="p-3">Medication</th>
                    <th className="p-3">Dose</th>
                    <th className="p-3">Frequency</th>
                    <th className="p-3">Meal Relation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {activeMeds.map((med) => (
                    <tr key={med.id} className="hover:bg-ink-50/50">
                      <td className="p-3 font-bold text-ink-900">
                        {med.medicine_name} {med.strength || ''}
                      </td>
                      {/* Never substitute a default dose or frequency here: an
                          invented value on a doctor-facing brief is a clinical
                          error, whereas a blank is an honest "not recorded". */}
                      <td className="p-3 text-ink-800">
                        {med.dose_amount || <span className="text-ink-400 italic">Not recorded</span>}
                      </td>
                      <td className="p-3 font-semibold text-teal-800">
                        {med.frequency_raw || med.frequency_code || (
                          <span className="text-ink-400 italic font-normal">Not recorded</span>
                        )}
                      </td>
                      <td className="p-3 text-ink-600">{mealRelationLabel(med.with_food)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent Doctor Consultations */}
        {visits.length > 0 && (
          <div className="space-y-3 pt-4 border-t border-ink-200 text-xs">
            <h2 className="text-sm font-bold uppercase tracking-wider text-ink-900 flex items-center gap-2">
              <StethoscopeIcon size={16} className="text-teal-700" />
              Recent Consultations
            </h2>
            <div className="space-y-2">
              {visits.map((v) => (
                <div key={v.id} className="p-3 rounded-lg border border-ink-200 bg-ink-50/40">
                  <div className="flex items-center justify-between font-bold text-ink-900">
                    <span>{v.doctor_name || 'Doctor Visit'}</span>
                    <span className="text-ink-500 font-normal">{v.visit_date}</span>
                  </div>
                  {v.diagnosis && <p className="text-teal-800 font-semibold mt-1">Diagnosis: {v.diagnosis}</p>}
                  {v.doctor_advice && <p className="text-ink-600 mt-0.5">Notes: {v.doctor_advice}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="pt-4 border-t border-ink-100 text-[11px] text-ink-400 text-center">
          Generated via Medfolio Patient Record System
        </div>
      </div>
    </div>
  );
}
