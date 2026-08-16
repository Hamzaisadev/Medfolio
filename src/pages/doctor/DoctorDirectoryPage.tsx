import { useState, useEffect, useMemo, useCallback } from 'react';
import { AppShell } from '../../components/layout/AppShell';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Toast } from '../../components/ui/Toast';
import { EmptyState } from '../../components/ui/EmptyState';
import { visitsRepo, medicinesRepo } from '../../lib/db';
import { todayInAppTz } from '../../lib/time';
import type { Tables } from '../../lib/supabase/types';

interface DoctorSummary {
  name: string;
  clinic?: string | null;
  totalVisits: number;
  lastVisitDate: string;
  nextFollowUp?: string | null;
  totalFeesPaid: number;
  visits: Tables<'visits'>[];
  medicines: Tables<'medicines'>[];
  tests: Tables<'test_orders'>[];
}

import { useAuth } from '../../lib/auth/AuthContext';

export function DoctorDirectoryPage() {
  const { user, profile } = useAuth();
  const [visits, setVisits] = useState<Tables<'visits'>[]>([]);
  const [medicines, setMedicines] = useState<Tables<'medicines'>[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDoctor, setSelectedDoctor] = useState<DoctorSummary | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // New Visit Modal state
  const [isAddVisitModalOpen, setIsAddVisitModalOpen] = useState(false);
  const [newDocName, setNewDocName] = useState('');
  const [newClinic, setNewClinic] = useState('');
  const [newDiagnosis, setNewDiagnosis] = useState('');
  const [newAdvice, setNewAdvice] = useState('');
  const [newDate, setNewDate] = useState(todayInAppTz());
  const [newFollowUp, setNewFollowUp] = useState('');
  const [newCost, setNewCost] = useState('');

  const effectiveUserId = user?.id || profile?.user_id || '';
  const effectiveProfileId = profile?.id || effectiveUserId;

  const loadData = useCallback(async () => {
    if (!effectiveUserId) return;
    setIsLoading(true);
    try {
      const [vList, mList] = await Promise.all([
        visitsRepo.listVisits(effectiveProfileId),
        medicinesRepo.listMedicines(effectiveUserId),
      ]);
      setVisits(vList);
      setMedicines(mList);
    } catch (err) {
      console.error('Failed to load doctor records:', err);
    } finally {
      setIsLoading(false);
    }
  }, [effectiveUserId, effectiveProfileId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Aggregate by Doctor Name
  const doctorSummaries: DoctorSummary[] = useMemo(() => {
    const map: Record<string, DoctorSummary> = {};

    for (const v of visits) {
      const docName = v.doctor_name?.trim() || 'General Consulting Physician';
      if (!map[docName]) {
        map[docName] = {
          name: docName,
          clinic: v.clinic_name || undefined,
          totalVisits: 0,
          lastVisitDate: v.visit_date,
          nextFollowUp: v.follow_up_date || undefined,
          totalFeesPaid: 0,
          visits: [],
          medicines: [],
          tests: [],
        };
      }

      const entry = map[docName]!;
      entry.totalVisits += 1;
      entry.visits.push(v);
      if (v.visit_cost) entry.totalFeesPaid += Number(v.visit_cost);
      if (v.visit_date > entry.lastVisitDate) entry.lastVisitDate = v.visit_date;
      if (v.follow_up_date) entry.nextFollowUp = v.follow_up_date;
      if (v.clinic_name) entry.clinic = v.clinic_name;

      // Associate medicines created from this visit
      const visitMeds = medicines.filter((m) => m.visit_id === v.id);
      entry.medicines.push(...visitMeds);
    }

    return Object.values(map).sort((a, b) => b.lastVisitDate.localeCompare(a.lastVisitDate));
  }, [visits, medicines]);

  const filteredDoctors = useMemo(() => {
    if (!searchQuery.trim()) return doctorSummaries;
    const q = searchQuery.toLowerCase();
    return doctorSummaries.filter(
      (d) => d.name.toLowerCase().includes(q) || (d.clinic && d.clinic.toLowerCase().includes(q))
    );
  }, [doctorSummaries, searchQuery]);

  const handleCreateVisit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDocName.trim()) return;

    try {
      await visitsRepo.createVisit({
        user_id: effectiveUserId,
        profile_id: effectiveProfileId,
        doctor_name: newDocName.trim(),
        clinic_name: newClinic.trim() || null,
        visit_date: newDate,
        diagnosis: newDiagnosis.trim() || null,
        doctor_advice: newAdvice.trim() || null,
        follow_up_date: newFollowUp || null,
        visit_cost: newCost ? parseFloat(newCost) : null,
        currency: 'PKR',
      });

      setToastMessage(`Added consultation record for Dr. ${newDocName}.`);
      setIsAddVisitModalOpen(false);
      setNewDocName('');
      setNewClinic('');
      setNewDiagnosis('');
      setNewAdvice('');
      setNewFollowUp('');
      setNewCost('');
      await loadData();
    } catch (err) {
      console.error('Failed to create visit:', err);
      setToastMessage('Failed to save visit record.');
    }
  };

  return (
    <AppShell>
      <div className="space-y-6 max-w-5xl mx-auto">
        <PageHeader
          title="Doctor Directory & Consultation Timelines"
          description="Manage your physician network, clinic locations, historical advice notes, and doctor-specific prescription records."
          action={
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsAddVisitModalOpen(true)}
              className="font-bold shadow-xs flex items-center gap-1.5"
            >
              <span>👨‍⚕️</span>
              <span>+ Add Doctor Consultation</span>
            </Button>
          }
        />

        <Toast
          open={Boolean(toastMessage)}
          onClose={() => setToastMessage(null)}
          message={toastMessage || ''}
          tone="ok"
        />

        {/* Search Bar */}
        <div className="flex items-center justify-between gap-3">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by doctor name or clinic/hospital..."
            className="h-10 px-4 text-xs sm:text-sm bg-white border border-ink-200 rounded-xl text-ink-900 focus:outline-none focus:ring-2 focus:ring-teal-500 max-w-md w-full shadow-xs"
          />

          <span className="text-xs font-bold text-ink-500">
            {filteredDoctors.length} {filteredDoctors.length === 1 ? 'Physician' : 'Physicians'}
          </span>
        </div>

        {/* Doctor Cards Grid */}
        {isLoading ? (
          <div className="py-12 text-center text-sm text-ink-500">Loading doctor profiles...</div>
        ) : filteredDoctors.length === 0 ? (
          <EmptyState
            heading="No doctors recorded yet"
            description="When you scan prescriptions or log visits, your doctors and their consultation history will appear here."
            action={
              <Button size="sm" onClick={() => setIsAddVisitModalOpen(true)}>
                + Add Doctor Consultation
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDoctors.map((doc) => (
              <Card key={doc.name} className="flex flex-col justify-between hover:border-teal-300 transition-all shadow-xs">
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-2xl bg-teal-100 text-teal-900 font-black text-sm flex items-center justify-center shrink-0">
                        👨‍⚕️
                      </div>
                      <div>
                        <h3 className="font-bold text-sm text-ink-900">Dr. {doc.name}</h3>
                        {doc.clinic && <p className="text-xs text-ink-500">{doc.clinic}</p>}
                      </div>
                    </div>
                    <Badge tone="ok" size="sm">{doc.totalVisits} {doc.totalVisits === 1 ? 'Visit' : 'Visits'}</Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs bg-ink-50/70 p-2.5 rounded-xl border border-ink-100">
                    <div>
                      <span className="text-ink-400 block text-[10px]">Last Consultation:</span>
                      <span className="font-bold text-ink-800">{doc.lastVisitDate}</span>
                    </div>
                    <div>
                      <span className="text-ink-400 block text-[10px]">Total Fees Paid:</span>
                      <span className="font-bold text-teal-900">PKR {doc.totalFeesPaid.toLocaleString()}</span>
                    </div>
                  </div>

                  {doc.nextFollowUp && (
                    <div className="text-xs text-amber-900 bg-amber-50 p-2 rounded-lg border border-amber-200 flex items-center gap-1.5">
                      <span>📅</span>
                      <span>Next Follow-up Due: <strong>{doc.nextFollowUp}</strong></span>
                    </div>
                  )}

                  {doc.medicines.length > 0 && (
                    <div className="text-xs space-y-1">
                      <span className="text-ink-500 font-semibold block text-[11px]">Prescribed ({doc.medicines.length}):</span>
                      <div className="flex flex-wrap gap-1">
                        {doc.medicines.slice(0, 3).map((m) => (
                          <Badge key={m.id} tone="neutral" size="sm">
                            {m.medicine_name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-ink-100 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setSelectedDoctor(doc)}
                    className="text-xs font-bold text-teal-800 hover:text-teal-950 flex items-center gap-1 hover:underline"
                  >
                    <span>View Doctor Timeline</span>
                    <span>&rarr;</span>
                  </button>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs"
                    onClick={() => {
                      setNewDocName(doc.name);
                      setNewClinic(doc.clinic || '');
                      setIsAddVisitModalOpen(true);
                    }}
                  >
                    + Log Visit
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Doctor-Specific Deep Timeline Modal */}
        {selectedDoctor && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-2xl w-full p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95 max-h-[90vh] flex flex-col">
              {/* Modal Header */}
              <div className="flex items-start justify-between pb-3 border-b border-ink-200 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-teal-100 text-teal-900 text-xl font-bold flex items-center justify-center shrink-0">
                    👨‍⚕️
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-ink-900">Dr. {selectedDoctor.name}</h2>
                    <p className="text-xs text-ink-500">{selectedDoctor.clinic || 'Consulting Clinic'} • Total Consultations: {selectedDoctor.totalVisits}</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedDoctor(null)}
                  className="text-ink-400 hover:text-ink-700 text-sm font-bold p-1"
                >
                  ✕
                </button>
              </div>

              {/* Scrollable Doctor Timeline Content */}
              <div className="flex-1 overflow-y-auto space-y-4 pr-1 text-xs">
                {/* Doctor Stats Summary */}
                <div className="grid grid-cols-3 gap-2.5 bg-ink-50 p-3 rounded-2xl border border-ink-200 text-center">
                  <div>
                    <span className="text-ink-500 text-[10px] block">Total Visits</span>
                    <span className="font-bold text-sm text-ink-900">{selectedDoctor.totalVisits}</span>
                  </div>
                  <div>
                    <span className="text-ink-500 text-[10px] block">Total Fees Paid</span>
                    <span className="font-bold text-sm text-teal-900">PKR {selectedDoctor.totalFeesPaid.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-ink-500 text-[10px] block">Prescriptions</span>
                    <span className="font-bold text-sm text-purple-900">{selectedDoctor.medicines.length}</span>
                  </div>
                </div>

                {/* Consultation History */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-ink-800">
                    Consultation History & Doctor Advice
                  </h3>

                  <div className="space-y-2.5">
                    {selectedDoctor.visits.map((v) => (
                      <div key={v.id} className="p-3.5 rounded-2xl border border-ink-200 bg-white space-y-1.5 shadow-2xs">
                        <div className="flex items-center justify-between font-bold text-ink-900">
                          <span className="text-sm">Consultation on {v.visit_date}</span>
                          {v.visit_cost && (
                            <span className="text-teal-900 font-black">
                              PKR {Number(v.visit_cost).toLocaleString()}
                            </span>
                          )}
                        </div>

                        {v.diagnosis && (
                          <p className="text-ink-800 font-semibold">
                            Diagnosis: <strong className="text-teal-950">{v.diagnosis}</strong>
                          </p>
                        )}

                        {v.doctor_advice && (
                          <div className="p-2.5 bg-teal-50/60 rounded-xl border border-teal-200 text-ink-800 leading-relaxed">
                            <span className="font-bold text-teal-950 block text-[11px] mb-0.5">Doctor's Advice:</span>
                            {v.doctor_advice}
                          </div>
                        )}

                        {v.follow_up_date && (
                          <p className="text-amber-900 text-[11px] font-medium pt-1">
                            📅 Follow-up scheduled for: <strong>{v.follow_up_date}</strong>
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Prescriptions Written by this Doctor */}
                {selectedDoctor.medicines.length > 0 && (
                  <div className="space-y-2 pt-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-ink-800">
                      Prescribed Medications ({selectedDoctor.medicines.length})
                    </h3>

                    <div className="border border-ink-200 rounded-xl overflow-hidden">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-ink-100 text-ink-700 font-bold border-b border-ink-200">
                            <th className="p-2">Medicine</th>
                            <th className="p-2">Dosage</th>
                            <th className="p-2">Start Date</th>
                            <th className="p-2">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-ink-100">
                          {selectedDoctor.medicines.map((m) => (
                            <tr key={m.id}>
                              <td className="p-2 font-bold text-ink-900">{m.medicine_name} {m.strength || ''}</td>
                              <td className="p-2 text-ink-700">{m.frequency_code || 'Daily'}</td>
                              <td className="p-2 text-ink-500">{m.start_date}</td>
                              <td className="p-2">
                                <Badge tone={m.is_ongoing ? 'info' : 'neutral'} size="sm">
                                  {m.is_ongoing ? 'Ongoing' : 'Course'}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="pt-3 border-t border-ink-200 flex items-center justify-between shrink-0">
                <a
                  href="/doctor"
                  className="text-xs font-bold text-teal-800 hover:underline flex items-center gap-1"
                >
                  <span>🖨️ Export Doctor Brief</span>
                </a>

                <Button variant="primary" size="sm" onClick={() => setSelectedDoctor(null)}>
                  Done
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Add Visit Modal */}
        {isAddVisitModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-5 space-y-4 shadow-xl animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-ink-900">Add Doctor Consultation</h3>
                <button type="button" onClick={() => setIsAddVisitModalOpen(false)} className="text-ink-400 hover:text-ink-700 text-sm font-bold">
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateVisit} className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-ink-700 mb-1">Doctor Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Farooq / Ayesha"
                    value={newDocName}
                    onChange={(e) => setNewDocName(e.target.value)}
                    className="w-full h-10 px-3 bg-ink-50 border border-ink-200 rounded-xl text-ink-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-semibold text-ink-700 mb-1">Clinic / Hospital</label>
                    <input
                      type="text"
                      placeholder="e.g. South City Hospital"
                      value={newClinic}
                      onChange={(e) => setNewClinic(e.target.value)}
                      className="w-full h-10 px-3 bg-ink-50 border border-ink-200 rounded-xl text-ink-900 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-ink-700 mb-1">Consultation Date</label>
                    <input
                      type="date"
                      required
                      value={newDate}
                      onChange={(e) => setNewDate(e.target.value)}
                      className="w-full h-10 px-3 bg-ink-50 border border-ink-200 rounded-xl text-ink-900 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-ink-700 mb-1">Clinical Diagnosis</label>
                  <input
                    type="text"
                    placeholder="e.g. Hypertension, Root Canal, Diabetes review"
                    value={newDiagnosis}
                    onChange={(e) => setNewDiagnosis(e.target.value)}
                    className="w-full h-10 px-3 bg-ink-50 border border-ink-200 rounded-xl text-ink-900 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-ink-700 mb-1">Doctor's Advice & Notes</label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Reduce sodium intake, repeat lipid profile in 4 weeks"
                    value={newAdvice}
                    onChange={(e) => setNewAdvice(e.target.value)}
                    className="w-full p-2.5 bg-ink-50 border border-ink-200 rounded-xl text-ink-900 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-semibold text-ink-700 mb-1">Follow-up Date</label>
                    <input
                      type="date"
                      value={newFollowUp}
                      onChange={(e) => setNewFollowUp(e.target.value)}
                      className="w-full h-10 px-3 bg-ink-50 border border-ink-200 rounded-xl text-ink-900 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-ink-700 mb-1">Consultation Fee (PKR)</label>
                    <input
                      type="number"
                      placeholder="e.g. 3000"
                      value={newCost}
                      onChange={(e) => setNewCost(e.target.value)}
                      className="w-full h-10 px-3 bg-ink-50 border border-ink-200 rounded-xl text-ink-900 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="pt-3 flex justify-end gap-2">
                  <Button variant="ghost" size="sm" type="button" onClick={() => setIsAddVisitModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button variant="primary" size="sm" type="submit" className="font-bold">
                    Save Consultation
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
