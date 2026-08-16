import type { Medicine } from '../lib/db/medicines';
import type { LabResult } from '../lib/db/reports';
import type { GlucoseReading, BloodPressureReading } from './vitals';

export interface DoctorQuestion {
  id: string;
  category: 'medications' | 'lab_results' | 'vitals' | 'general';
  categoryLabel: string;
  priority: 'high' | 'medium' | 'routine';
  question: string;
  context: string;
  isChecked?: boolean;
}

export function generateDoctorQuestions(params: {
  medicines: Medicine[];
  labResults: LabResult[];
  glucoseReadings: GlucoseReading[];
  bpReadings: BloodPressureReading[];
  chronicConditions?: string;
}): DoctorQuestion[] {
  const questions: DoctorQuestion[] = [];
  const { medicines, labResults, glucoseReadings, bpReadings, chronicConditions } = params;

  // 1. Check abnormal lab results
  const abnormalLabs = labResults.filter(
    (r) => r.range_status === 'above' || r.range_status === 'below'
  );

  abnormalLabs.slice(0, 3).forEach((lab, idx) => {
    questions.push({
      id: `lab-${idx}-${lab.id || lab.test_name}`,
      category: 'lab_results',
      categoryLabel: 'Lab Test Inquiries',
      priority: 'high',
      question: `My ${lab.test_name} was reported as ${lab.value_text} (${lab.range_status} reference range). What does this indicate for my treatment?`,
      context: `Analyte: ${lab.test_name} • Value: ${lab.value_text} • Ref: ${lab.reference_range || 'N/A'}`,
    });
  });

  // 2. Check blood glucose anomalies
  const recentGlucose = glucoseReadings.slice(0, 10);
  const highGlucose = recentGlucose.filter((g) => g.value_mg_dl > 180);
  const lowGlucose = recentGlucose.filter((g) => g.value_mg_dl < 70);

  if (lowGlucose.length > 0) {
    questions.push({
      id: 'vitals-hypo',
      category: 'vitals',
      categoryLabel: 'Blood Sugar Monitoring',
      priority: 'high',
      question: `I recorded low blood sugar readings (below 70 mg/dL). Should we adjust the dose or timing of my diabetes medications?`,
      context: `Recorded ${lowGlucose.length} low readings recently (lowest: ${Math.min(...lowGlucose.map((g) => g.value_mg_dl))} mg/dL).`,
    });
  } else if (highGlucose.length > 0) {
    questions.push({
      id: 'vitals-hyper',
      category: 'vitals',
      categoryLabel: 'Blood Sugar Monitoring',
      priority: 'medium',
      question: `My post-meal glucose frequently exceeds 180 mg/dL. Are there additional dietary adjustments or dose modifications needed?`,
      context: `${highGlucose.length} recent readings exceeded 180 mg/dL.`,
    });
  }

  // 3. Check blood pressure anomalies
  const recentBp = bpReadings.slice(0, 10);
  const stage2Bp = recentBp.filter((b) => b.systolic >= 140 || b.diastolic >= 90);

  if (stage2Bp.length > 0) {
    questions.push({
      id: 'vitals-bp',
      category: 'vitals',
      categoryLabel: 'Blood Pressure Control',
      priority: 'high',
      question: `My systolic blood pressure has consistently hovered around ${Math.round(
        stage2Bp.reduce((acc, b) => acc + b.systolic, 0) / stage2Bp.length
      )} mmHg. Is my current antihypertensive regimen optimal?`,
      context: `${stage2Bp.length} of recent readings were in Stage 2 range.`,
    });
  }

  // 4. Check active long-term medications
  const ongoingMeds = medicines.filter((m) => m.is_ongoing || !m.end_date);
  ongoingMeds.slice(0, 2).forEach((med, idx) => {
    questions.push({
      id: `med-duration-${idx}`,
      category: 'medications',
      categoryLabel: 'Prescription Review',
      priority: 'medium',
      question: `How long do you anticipate I will need to continue taking ${med.medicine_name}? Are there any routine kidney or liver function tests I should take?`,
      context: `Active medication: ${med.medicine_name} (${med.strength || 'standard dose'})`,
    });
  });

  // 5. General preventive follow-up
  if (chronicConditions) {
    questions.push({
      id: 'chronic-lifestyle',
      category: 'general',
      categoryLabel: 'Long-term Management',
      priority: 'routine',
      question: `Are there specific lifestyle changes, supplements, or dietary guidelines that would best support my ${chronicConditions}?`,
      context: `Diagnosed condition: ${chronicConditions}`,
    });
  }

  // Fallback if records are minimal
  if (questions.length === 0) {
    questions.push(
      {
        id: 'default-1',
        category: 'general',
        categoryLabel: 'General Consultation',
        priority: 'routine',
        question: 'Are all my current medications safe to take together, and are there any food interactions I should avoid?',
        context: 'Routine medication safety check',
      },
      {
        id: 'default-2',
        category: 'general',
        categoryLabel: 'General Consultation',
        priority: 'routine',
        question: 'When should I schedule my next routine blood work and follow-up appointment?',
        context: 'Follow-up timeline planning',
      }
    );
  }

  return questions;
}
