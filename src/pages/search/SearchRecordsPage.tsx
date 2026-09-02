import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { AppShell } from '../../components/layout/AppShell';
import { PageHeader } from '../../components/layout/PageHeader';
import { Input } from '../../components/ui/Input';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';
import { XIcon } from '../../components/ui/icons';
import { visitsRepo, reportsRepo, medicinesRepo, sideEffectsRepo } from '../../lib/db';
import type { Tables } from '../../lib/supabase/types';

interface SearchResultItem {
  id: string;
  category: 'visit' | 'medicine' | 'report' | 'symptom';
  title: string;
  subtitle: string;
  snippet: string;
  date: string;
  linkUrl: string;
  badgeText: string;
}

import { useAuth } from '../../lib/auth/AuthContext';

export function SearchRecordsPage() {
  const { user, profile } = useAuth();
  const [query, setQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');

  const [visits, setVisits] = useState<Tables<'visits'>[]>([]);
  const [medicines, setMedicines] = useState<Tables<'medicines'>[]>([]);
  const [reports, setReports] = useState<Tables<'reports'>[]>([]);
  const [reportResults, setReportResults] = useState<Tables<'report_results'>[]>([]);
  const [sideEffects, setSideEffects] = useState<Tables<'side_effects'>[]>([]);

  const effectiveUserId = user?.id || profile?.user_id || '';
  const effectiveProfileId = profile?.id || effectiveUserId;

  useEffect(() => {
    async function loadAllRecords() {
      if (!effectiveUserId) return;
      try {
        const [vList, mList, rList, sList] = await Promise.all([
          visitsRepo.listVisits(effectiveProfileId),
          medicinesRepo.listMedicines(effectiveProfileId),
          reportsRepo.listReports(effectiveProfileId),
          sideEffectsRepo.listSideEffects(effectiveProfileId),
        ]);

        setVisits(vList);
        setMedicines(mList);
        setReports(rList);
        setSideEffects(sList);

        // Fetch results for all reports
        const allRes = await Promise.all(
          rList.map((r) => reportsRepo.listResultsForReport(r.id))
        );
        setReportResults(allRes.flat());
      } catch (err) {
        console.error('Failed to load records for search index:', err);
      }
    }
    loadAllRecords();
  }, [effectiveUserId, effectiveProfileId]);

  // Instant Local Search Index Computation
  const searchResults = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase().trim();
    const results: SearchResultItem[] = [];

    // 1. Search Visits
    for (const v of visits) {
      const matchDoc = v.doctor_name && v.doctor_name.toLowerCase().includes(q);
      const matchClinic = v.clinic_name && v.clinic_name.toLowerCase().includes(q);
      const matchDiag = v.diagnosis && v.diagnosis.toLowerCase().includes(q);
      const matchAdvice = v.doctor_advice && v.doctor_advice.toLowerCase().includes(q);

      if (matchDoc || matchClinic || matchDiag || matchAdvice) {
        results.push({
          id: `visit-${v.id}`,
          category: 'visit',
          title: v.doctor_name ? `Doctor Visit — ${v.doctor_name}` : 'Doctor Visit',
          subtitle: v.clinic_name || 'Clinic / Hospital',
          snippet: v.diagnosis ? `Diagnosis: ${v.diagnosis}` : v.doctor_advice || 'Consultation record',
          date: v.visit_date,
          linkUrl: '/timeline',
          badgeText: 'Doctor Visit',
        });
      }
    }

    // 2. Search Medicines
    for (const m of medicines) {
      const matchName = m.medicine_name.toLowerCase().includes(q);
      const matchInst = m.instructions && m.instructions.toLowerCase().includes(q);
      const matchStrength = m.strength && m.strength.toLowerCase().includes(q);

      if (matchName || matchInst || matchStrength) {
        results.push({
          id: `med-${m.id}`,
          category: 'medicine',
          title: m.medicine_name,
          subtitle: `${m.strength || ''} • ${m.frequency_code || m.frequency_raw || 'OD'}`,
          snippet: m.instructions ? `Instructions: ${m.instructions}` : `Started on ${m.start_date}`,
          date: m.start_date,
          linkUrl: `/medicines/${m.id}`,
          badgeText: 'Prescription',
        });
      }
    }

    // 3. Search Lab Reports & Biomarker Results
    for (const r of reports) {
      const matchTitle = r.title.toLowerCase().includes(q);
      const matchLab = r.lab_name && r.lab_name.toLowerCase().includes(q);

      if (matchTitle || matchLab) {
        results.push({
          id: `rep-${r.id}`,
          category: 'report',
          title: r.title,
          subtitle: r.lab_name || 'Diagnostic Laboratory',
          snippet: `Lab Report Date: ${r.report_date}`,
          date: r.report_date,
          linkUrl: '/reports',
          badgeText: 'Lab Report',
        });
      }
    }

    // Individual Result Parameters
    for (const res of reportResults) {
      if (res.test_name.toLowerCase().includes(q) || (res.value_text && res.value_text.toLowerCase().includes(q))) {
        results.push({
          id: `res-${res.id}`,
          category: 'report',
          title: `Lab Result: ${res.test_name}`,
          subtitle: `Value: ${res.value_text} ${res.unit || ''}`,
          snippet: res.reference_range ? `Typical range: ${res.reference_range}` : 'Diagnostic result',
          date: res.created_at.slice(0, 10),
          linkUrl: '/reports',
          badgeText: 'Biomarker',
        });
      }
    }

    // 4. Search Symptoms / Side Effects
    for (const s of sideEffects) {
      if (s.note && s.note.toLowerCase().includes(q)) {
        results.push({
          id: `side-${s.id}`,
          category: 'symptom',
          title: `Logged Symptom / Side Effect`,
          subtitle: s.severity ? `Severity: ${s.severity}` : 'Note',
          snippet: s.note,
          date: s.occurred_at ? s.occurred_at.slice(0, 10) : s.created_at.slice(0, 10),
          linkUrl: '/timeline',
          badgeText: 'Symptom',
        });
      }
    }

    return results;
  }, [query, visits, medicines, reports, reportResults, sideEffects]);

  const filteredResults = useMemo(() => {
    if (filterCategory === 'all') return searchResults;
    return searchResults.filter((r) => r.category === filterCategory);
  }, [searchResults, filterCategory]);

  return (
    <AppShell>
      <PageHeader
        title="Search Records"
        description="Search your prescriptions, doctor visits, lab tests, dosages, and medical notes locally with zero lag."
      />

      {/* Instant Search Bar */}
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="relative">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. Panadol, Augmentin, Hemoglobin, Dr. Joynal, knee pain..."
            className="h-14 text-base pl-12 shadow-sm rounded-xl"
          />
          <div className="absolute left-4 top-4 text-ink-400 pointer-events-none">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-4 top-4 text-ink-400 hover:text-ink-700 p-1"
            >
              <XIcon size={16} />
            </button>
          )}
        </div>

        {/* Filter Chips */}
        {query && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {[
              { id: 'all', label: `All (${searchResults.length})` },
              { id: 'medicine', label: 'Medicines' },
              { id: 'visit', label: 'Doctor Visits' },
              { id: 'report', label: 'Lab Reports & Tests' },
              { id: 'symptom', label: 'Symptoms' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterCategory(tab.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
                  filterCategory === tab.id
                    ? 'bg-teal-800 text-white shadow-xs'
                    : 'bg-ink-100 text-ink-600 hover:bg-ink-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* Search Results List */}
        {!query.trim() ? (
          <div className="text-center py-12 space-y-2">
            <p className="text-sm font-semibold text-ink-700">Type any medicine, doctor name, symptom, or lab test</p>
            <p className="text-xs text-ink-400">
              Searches are performed entirely on your device with instant results.
            </p>
          </div>
        ) : filteredResults.length === 0 ? (
          <EmptyState
            heading="No matching records found"
            description={`No medical entries matched "${query}". Try searching for a different keyword or drug brand.`}
          />
        ) : (
          <div className="space-y-3">
            {filteredResults.map((item) => (
              <Link key={item.id} to={item.linkUrl} className="block group">
                <Card className="p-4 transition-all hover:border-teal-500 hover:shadow-md">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-ink-900 group-hover:text-teal-800">
                          {item.title}
                        </span>
                        <Badge tone="neutral" size="sm">
                          {item.badgeText}
                        </Badge>
                      </div>
                      <p className="text-xs text-ink-600 font-medium">{item.subtitle}</p>
                      <p className="text-xs text-ink-500 line-clamp-2">{item.snippet}</p>
                    </div>

                    <span className="text-[11px] text-ink-400 shrink-0">{item.date}</span>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
