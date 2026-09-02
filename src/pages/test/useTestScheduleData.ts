import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../lib/auth/AuthContext';
import { dosesRepo, medicinesRepo } from '../../lib/db';
import { readInventory } from '../../lib/inventory';
import { todayInAppTz } from '../../lib/time';
import { bucketOf, Bucket, BUCKET_ORDER } from '../../domain/timeBuckets';
import { deriveStatusOnRead } from '../../domain/adherence';
import type { Tables } from '../../lib/supabase/types';

export interface TestDoseItem {
  id: string;
  medicineId: string;
  medicineName: string;
  strength: string;
  doseAmount: string;
  form: string;
  scheduledMinutes: number;
  scheduledDate: string;
  status: 'pending' | 'taken' | 'skipped' | 'missed';
  withFood: boolean | null;
  instructions: string;
  remaining: number;
  skippedReason?: string | null;
  takenAt?: string | null;
  bucket: Bucket;
}

const SAMPLE_DOSES: TestDoseItem[] = [
  {
    id: 'sample-dose-1',
    medicineId: 'med-1',
    medicineName: 'Metformin HCl',
    strength: '500 mg',
    doseAmount: '1 tablet',
    form: 'tablet',
    scheduledMinutes: 480, // 8:00 AM
    scheduledDate: todayInAppTz(),
    status: 'pending',
    withFood: true,
    instructions: 'Take immediately with breakfast to avoid GI upset',
    remaining: 24,
    bucket: 'morning',
  },
  {
    id: 'sample-dose-2',
    medicineId: 'med-2',
    medicineName: 'Omeprazole',
    strength: '20 mg',
    doseAmount: '1 capsule',
    form: 'capsule',
    scheduledMinutes: 450, // 7:30 AM
    scheduledDate: todayInAppTz(),
    status: 'taken',
    takenAt: new Date().toISOString(),
    withFood: false,
    instructions: 'Take on an empty stomach 30 mins before first meal',
    remaining: 8,
    bucket: 'morning',
  },
  {
    id: 'sample-dose-3',
    medicineId: 'med-3',
    medicineName: 'Lisinopril',
    strength: '10 mg',
    doseAmount: '1 tablet',
    form: 'tablet',
    scheduledMinutes: 780, // 1:00 PM
    scheduledDate: todayInAppTz(),
    status: 'pending',
    withFood: null,
    instructions: 'Monitor blood pressure before dose',
    remaining: 4, // Low stock
    bucket: 'afternoon',
  },
  {
    id: 'sample-dose-4',
    medicineId: 'med-4',
    medicineName: 'Multivitamin Complex',
    strength: 'Daily Formula',
    doseAmount: '1 softgel',
    form: 'softgel',
    scheduledMinutes: 840, // 2:00 PM
    scheduledDate: todayInAppTz(),
    status: 'pending',
    withFood: true,
    instructions: 'Take with lunch and a full glass of water',
    remaining: 45,
    bucket: 'afternoon',
  },
  {
    id: 'sample-dose-5',
    medicineId: 'med-1',
    medicineName: 'Metformin HCl',
    strength: '500 mg',
    doseAmount: '1 tablet',
    form: 'tablet',
    scheduledMinutes: 1200, // 8:00 PM
    scheduledDate: todayInAppTz(),
    status: 'missed',
    withFood: true,
    instructions: 'Take with evening meal',
    remaining: 24,
    bucket: 'evening',
  },
  {
    id: 'sample-dose-6',
    medicineId: 'med-5',
    medicineName: 'Atorvastatin Calcium',
    strength: '20 mg',
    doseAmount: '1 tablet',
    form: 'tablet',
    scheduledMinutes: 1320, // 10:00 PM
    scheduledDate: todayInAppTz(),
    status: 'pending',
    withFood: null,
    instructions: 'Take consistently at bedtime',
    remaining: 0, // Out of stock
    bucket: 'night',
  },
  {
    id: 'sample-dose-7',
    medicineId: 'med-6',
    medicineName: 'Melatonin',
    strength: '3 mg',
    doseAmount: '1 tablet',
    form: 'tablet',
    scheduledMinutes: 1350, // 10:30 PM
    scheduledDate: todayInAppTz(),
    status: 'pending',
    withFood: null,
    instructions: 'Take 30 mins before sleep',
    remaining: 18,
    bucket: 'night',
  },
];

export function useTestScheduleData() {
  const { user, profile } = useAuth();
  const [doses, setDoses] = useState<TestDoseItem[]>(SAMPLE_DOSES);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>(todayInAppTz());
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const effectiveUserId = user?.id || profile?.user_id || '';
  const effectiveProfileId = profile?.id || effectiveUserId;

  const loadData = useCallback(async () => {
    if (!effectiveProfileId) return;
    try {
      setIsLoading(true);
      const [fetchedDoses, fetchedMeds] = await Promise.all([
        dosesRepo.listDosesForDate(effectiveProfileId, selectedDate),
        medicinesRepo.listMedicines(effectiveProfileId),
      ]);

      if (fetchedDoses.length > 0 && fetchedMeds.length > 0) {
        const medsMap: Record<string, Tables<'medicines'>> = {};
        for (const m of fetchedMeds) medsMap[m.id] = m;
        const inv = readInventory(effectiveProfileId);

        const mapped: TestDoseItem[] = fetchedDoses.map((d) => {
          const med = medsMap[d.medicine_id];
          return {
            id: d.id,
            medicineId: d.medicine_id,
            medicineName: med?.medicine_name || 'Prescribed Medicine',
            strength: med?.strength || '',
            doseAmount: med?.dose_amount || (med?.form ? `1 ${med.form}` : '1 dose'),
            form: med?.form || 'tablet',
            scheduledMinutes: d.scheduled_minutes,
            scheduledDate: d.scheduled_date,
            status: deriveStatusOnRead(d, new Date()),
            withFood: med?.with_food ?? null,
            instructions: med?.instructions || '',
            remaining: inv[d.medicine_id] ?? 10,
            skippedReason: d.skipped_reason,
            takenAt: d.taken_at,
            bucket: bucketOf(d.scheduled_minutes),
          };
        });

        setDoses(mapped);
      }
    } catch {
      // Fall back to sample doses if error or offline
    } finally {
      setIsLoading(false);
    }
  }, [effectiveProfileId, selectedDate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleTake = (doseId: string) => {
    setDoses((prev) =>
      prev.map((d) =>
        d.id === doseId
          ? { ...d, status: 'taken', takenAt: new Date().toISOString() }
          : d
      )
    );
    const item = doses.find((d) => d.id === doseId);
    setToastMessage(`✓ Logged ${item?.medicineName || 'dose'} as taken`);
  };

  const handleSkip = (doseId: string, reason = 'Skipped by patient') => {
    setDoses((prev) =>
      prev.map((d) =>
        d.id === doseId ? { ...d, status: 'skipped', skippedReason: reason } : d
      )
    );
    setToastMessage(`Dose marked as skipped (${reason})`);
  };

  const handleUndo = (doseId: string) => {
    setDoses((prev) =>
      prev.map((d) =>
        d.id === doseId ? { ...d, status: 'pending', takenAt: null, skippedReason: null } : d
      )
    );
    setToastMessage('Dose reset to pending');
  };

  const handleBatchTake = (bucket: Bucket) => {
    const dueCount = doses.filter(
      (d) => d.bucket === bucket && (d.status === 'pending' || d.status === 'missed')
    ).length;

    setDoses((prev) =>
      prev.map((d) =>
        d.bucket === bucket && (d.status === 'pending' || d.status === 'missed')
          ? { ...d, status: 'taken', takenAt: new Date().toISOString() }
          : d
      )
    );
    setToastMessage(`✓ Logged ${dueCount} ${bucket} doses as taken`);
  };

  const groupedBuckets: Record<Bucket, TestDoseItem[]> = {
    morning: [],
    afternoon: [],
    evening: [],
    night: [],
  };

  for (const d of doses) {
    groupedBuckets[d.bucket].push(d);
  }

  for (const b of BUCKET_ORDER) {
    groupedBuckets[b].sort((a, b) => a.scheduledMinutes - b.scheduledMinutes);
  }

  const takenCount = doses.filter((d) => d.status === 'taken').length;
  const pendingCount = doses.filter((d) => d.status === 'pending' || d.status === 'missed').length;
  const totalCount = doses.length;
  const adherencePercent = totalCount > 0 ? Math.round((takenCount / totalCount) * 100) : 0;

  return {
    doses,
    groupedBuckets,
    takenCount,
    pendingCount,
    totalCount,
    adherencePercent,
    isLoading,
    selectedDate,
    setSelectedDate,
    toastMessage,
    setToastMessage,
    handleTake,
    handleSkip,
    handleUndo,
    handleBatchTake,
  };
}
