import { describe, it, expect } from 'vitest';
import { generateDoctorQuestions } from '../doctorQuestions';
import type { GlucoseReading } from '../vitals';

describe('Smart Doctor Question Generator', () => {
  it('generates targeted questions for abnormal lab results', () => {
    const abnormalLab = {
      id: 'res-1',
      report_id: 'rep-1',
      user_id: 'user-1',
      test_name: 'ALT (SGPT)',
      canonical_name: null,
      value_text: '78 U/L',
      value_numeric: 78,
      unit: 'U/L',
      reference_range: '0-40',
      ref_low: 0,
      ref_high: 40,
      range_status: 'above' as const,
      created_at: new Date().toISOString(),
    };

    const questions = generateDoctorQuestions({
      medicines: [],
      labResults: [abnormalLab],
      glucoseReadings: [],
      bpReadings: [],
    });

    const labQuestion = questions.find((q) => q.category === 'lab_results');
    expect(labQuestion).toBeDefined();
    expect(labQuestion?.question).toContain('ALT (SGPT)');
    expect(labQuestion?.priority).toBe('high');
  });

  it('generates hypoglycemia question when blood glucose drops below 70', () => {
    const lowGlucose: GlucoseReading = {
      id: 'g-1',
      user_id: 'user-1',
      profile_id: 'prof-1',
      measured_at: new Date().toISOString(),
      type: 'fasting',
      value_mg_dl: 62,
    };

    const questions = generateDoctorQuestions({
      medicines: [],
      labResults: [],
      glucoseReadings: [lowGlucose],
      bpReadings: [],
    });

    const vitalsQuestion = questions.find((q) => q.id === 'vitals-hypo');
    expect(vitalsQuestion).toBeDefined();
    expect(vitalsQuestion?.question).toContain('below 70 mg/dL');
  });
});
