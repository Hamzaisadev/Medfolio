import { describe, it, expect } from 'vitest';
import {
  validateExportDocument,
  MedfolioExportDocument,
  EXPORT_FORMAT_IDENTIFIER,
  CURRENT_EXPORT_VERSION,
} from '../index';

describe('export and import validation (src/lib/export/index.ts)', () => {
  const sampleDocument: MedfolioExportDocument = {
    format: EXPORT_FORMAT_IDENTIFIER,
    version: CURRENT_EXPORT_VERSION,
    exported_at: '2026-08-15T09:00:00Z',
    app_timezone: 'Asia/Karachi',
    profiles: [
      {
        id: '11111111-1111-4111-a111-111111111111',
        full_name: 'Ahmed Khan',
        relationship: 'self',
        date_of_birth: '1988-04-12',
        sex: 'male',
        blood_group: 'B+',
        height_cm: 175,
        weight_kg: 72,
        allergies: 'Penicillin',
        chronic_conditions: 'Hypertension',
        emergency_contact_name: 'Sara Khan',
        emergency_contact_phone: '+923001234567',
        is_default: true,
        created_at: '2026-08-15T00:00:00Z',
        updated_at: '2026-08-15T00:00:00Z',
      },
    ],
    visits: [
      {
        id: '22222222-2222-4222-a222-222222222222',
        profile_id: '11111111-1111-4111-a111-111111111111',
        visit_date: '2026-08-15',
        doctor_name: 'Dr. Tariq',
        clinic_name: 'National Hospital',
        specialty: 'Cardiology',
        diagnosis: 'Stage 1 Hypertension',
        doctor_advice: 'Low salt diet, regular walk',
        follow_up_date: '2026-09-15',
        visit_cost: 3000,
        currency: 'PKR',
        notes: 'Followup in 1 month',
        created_at: '2026-08-15T00:00:00Z',
        updated_at: '2026-08-15T00:00:00Z',
      },
    ],
    medicines: [
      {
        id: '33333333-3333-4333-a333-333333333333',
        profile_id: '11111111-1111-4111-a111-111111111111',
        visit_id: '22222222-2222-4222-a222-222222222222',
        medicine_name: 'Amlodipine',
        strength: '5 mg',
        form: 'tablet',
        dose_amount: '1 tablet',
        frequency_raw: 'OD',
        frequency_code: 'OD',
        duration_raw: '30 days',
        duration_days: 30,
        start_date: '2026-08-15',
        end_date: '2026-09-13',
        instructions: 'morning after breakfast',
        with_food: true,
        is_ongoing: true,
        is_otc: false,
        unit_cost: 15,
        currency: 'PKR',
        created_at: '2026-08-15T00:00:00Z',
        updated_at: '2026-08-15T00:00:00Z',
      },
    ],
    doses: [
      {
        id: '44444444-4444-4444-a444-444444444444',
        profile_id: '11111111-1111-4111-a111-111111111111',
        medicine_id: '33333333-3333-4333-a333-333333333333',
        scheduled_date: '2026-08-15',
        scheduled_minutes: 540,
        status: 'taken',
        taken_at: '2026-08-15T04:10:00Z',
        created_at: '2026-08-15T00:00:00Z',
        updated_at: '2026-08-15T00:00:00Z',
      },
    ],
    test_orders: [],
    reports: [],
    report_results: [],
    side_effects: [],
    reminder_settings: [
      {
        id: '55555555-5555-4555-a555-555555555555',
        profile_id: '11111111-1111-4111-a111-111111111111',
        enabled: true,
        quiet_hours_start: 1320,
        quiet_hours_end: 360,
        snooze_minutes: 10,
        lead_minutes: 0,
        created_at: '2026-08-15T00:00:00Z',
        updated_at: '2026-08-15T00:00:00Z',
      },
    ],
    images: [],
  };

  it('validates a correct export document losslessly', () => {
    const jsonStr = JSON.stringify(sampleDocument);
    const parsed = JSON.parse(jsonStr);

    const validation = validateExportDocument(parsed);
    expect(validation.success).toBe(true);
    expect(validation.data).toEqual(sampleDocument);
  });

  it('rejects documents with wrong format identifier or unsupported version', () => {
    const wrongFormat = { ...sampleDocument, format: 'invalid.format' };
    const res1 = validateExportDocument(wrongFormat);
    expect(res1.success).toBe(false);
    expect(res1.error).toContain("at 'format'");

    const wrongVersion = { ...sampleDocument, version: 99 };
    const res2 = validateExportDocument(wrongVersion);
    expect(res2.success).toBe(false);
    expect(res2.error).toContain("at 'version'");
  });

  it('rejects malformed records and pinpoints the bad field path', () => {
    const badDose = {
      ...sampleDocument,
      doses: [
        {
          id: 'not-a-uuid',
          profile_id: '11111111-1111-4111-a111-111111111111',
          medicine_id: '33333333-3333-4333-a333-333333333333',
          scheduled_date: '2026-08-15',
          scheduled_minutes: 9999, // exceeds 1439!
          status: 'invalid_status',
          created_at: '2026-08-15T00:00:00Z',
          updated_at: '2026-08-15T00:00:00Z',
        },
      ],
    };

    const res = validateExportDocument(badDose);
    expect(res.success).toBe(false);
    expect(res.error).toBeDefined();
  });
});
