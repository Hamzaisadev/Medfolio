import { describe, it, expect } from 'vitest';
import { isActive, activeMedicines, recentlyFinishedMedicines, MedicineRecord } from '../activeMedicines';

describe('activeMedicines (src/domain/activeMedicines.ts)', () => {
  const today = '2026-08-15';

  it('includes ongoing chronic medicine', () => {
    const med: MedicineRecord = {
      id: '1',
      medicine_name: 'Amlodipine',
      start_date: '2025-01-01',
      is_ongoing: true,
      end_date: null,
      discontinued_at: null,
    };
    expect(isActive(med, today)).toBe(true);
  });

  it('includes active finite course where end_date >= today', () => {
    const med: MedicineRecord = {
      id: '2',
      medicine_name: 'Amoxicillin',
      start_date: '2026-08-12',
      end_date: '2026-08-18',
      is_ongoing: false,
      discontinued_at: null,
    };
    expect(isActive(med, today)).toBe(true);
  });

  it('CRITICAL: excludes finished course from the past (e.g. from 2024)', () => {
    const med: MedicineRecord = {
      id: '3',
      medicine_name: 'Azithromycin',
      start_date: '2024-05-01',
      end_date: '2024-05-06',
      is_ongoing: false,
      discontinued_at: null,
    };
    expect(isActive(med, today)).toBe(false);
  });

  it('excludes discontinued medicine even if ongoing flag is true', () => {
    const med: MedicineRecord = {
      id: '4',
      medicine_name: 'Metformin',
      start_date: '2025-01-01',
      is_ongoing: true,
      end_date: null,
      discontinued_at: '2026-08-01T12:00:00Z',
    };
    expect(isActive(med, today)).toBe(false);
  });

  it('excludes future-scheduled medicines not yet started', () => {
    const med: MedicineRecord = {
      id: '5',
      medicine_name: 'Upcoming course',
      start_date: '2026-08-20',
      end_date: '2026-08-27',
      is_ongoing: false,
      discontinued_at: null,
    };
    expect(isActive(med, today)).toBe(false);
  });

  it('deduplicates active medicines keeping the latest start_date', () => {
    const meds: MedicineRecord[] = [
      {
        id: 'old-course',
        medicine_name: 'Panadol',
        start_date: '2026-08-01',
        end_date: '2026-08-20',
        is_ongoing: false,
        discontinued_at: null,
      },
      {
        id: 'new-course',
        medicine_name: 'Panadol',
        start_date: '2026-08-10',
        end_date: '2026-08-25',
        is_ongoing: false,
        discontinued_at: null,
      },
    ];

    const active = activeMedicines(meds, today);
    expect(active).toHaveLength(1);
    expect(active[0]?.id).toBe('new-course');
  });

  it('extracts recently finished medicines within last 30 days', () => {
    const meds: MedicineRecord[] = [
      {
        id: 'finished-recently',
        medicine_name: 'Augmentin',
        start_date: '2026-08-01',
        end_date: '2026-08-07', // 8 days ago
        is_ongoing: false,
        discontinued_at: null,
      },
      {
        id: 'finished-ancient',
        medicine_name: 'Ciprofloxacin',
        start_date: '2025-01-01',
        end_date: '2025-01-07', // long ago
        is_ongoing: false,
        discontinued_at: null,
      },
    ];

    const recent = recentlyFinishedMedicines(meds, today, 30);
    expect(recent).toHaveLength(1);
    expect(recent[0]?.id).toBe('finished-recently');
  });
});
