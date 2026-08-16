import { z } from 'zod';

// ==========================================
// 1. Prescription Extraction Schemas
// ==========================================
export const extractPrescriptionRequestSchema = z.object({
  images: z
    .array(
      z.object({
        mimeType: z.string(),
        dataBase64: z.string().min(1),
      })
    )
    .min(1, 'At least one image is required')
    .max(5, 'Maximum 5 images allowed per prescription'),
});

export const extractedMedicineItemSchema = z.preprocess((val: any) => {
  if (typeof val === 'string') {
    return { medicine_name: val, confidence: 'high' };
  }
  if (typeof val === 'object' && val !== null) {
    const medicine_name =
      val.medicine_name ||
      val.name ||
      val.drug_name ||
      val.medicine ||
      val.brand_name ||
      'Prescribed Medicine';
    const strength = val.strength || val.potency || null;
    const form = val.form || val.dosage_form || null;
    const dose_amount = val.dose_amount || val.dose || val.dosage || null;
    const frequency_raw = val.frequency_raw || val.frequency || val.dosage_frequency || val.schedule || null;
    const duration_raw = val.duration_raw || val.duration || val.days || val.period || null;
    const instructions = val.instructions || val.directions || val.advice || null;
    const confidence = val.confidence === 'low' ? 'low' : 'high';

    return {
      medicine_name: String(medicine_name),
      strength: strength ? String(strength) : null,
      form: form ? String(form) : null,
      dose_amount: dose_amount ? String(dose_amount) : null,
      frequency_raw: frequency_raw ? String(frequency_raw) : null,
      duration_raw: duration_raw ? String(duration_raw) : null,
      instructions: instructions ? String(instructions) : null,
      confidence,
    };
  }
  return val;
}, z.object({
  medicine_name: z.string(),
  strength: z.string().nullable().optional(),
  form: z.string().nullable().optional(),
  dose_amount: z.string().nullable().optional(),
  frequency_raw: z.string().nullable().optional(),
  duration_raw: z.string().nullable().optional(),
  instructions: z.string().nullable().optional(),
  confidence: z.enum(['high', 'low']).default('high'),
}));

export const extractedTestOrderItemSchema = z.preprocess((val: any) => {
  if (typeof val === 'string') {
    return { test_name: val, confidence: 'high' };
  }
  if (typeof val === 'object' && val !== null) {
    const test_name = val.test_name || val.name || val.test || 'Investigation';
    const confidence = val.confidence === 'low' ? 'low' : 'high';
    return { test_name: String(test_name), confidence };
  }
  return val;
}, z.object({
  test_name: z.string(),
  confidence: z.enum(['high', 'low']).default('high'),
}));

export const extractPrescriptionResponseSchema = z.preprocess((val: any) => {
  if (typeof val === 'object' && val !== null) {
    return {
      ...val,
      readable: val.readable ?? true,
      medicines: Array.isArray(val.medicines) ? val.medicines : [],
      tests_ordered: Array.isArray(val.tests_ordered) ? val.tests_ordered : [],
    };
  }
  return val;
}, z.object({
  readable: z.boolean(),
  doctor_name: z.string().nullable().optional(),
  clinic_name: z.string().nullable().optional(),
  visit_date: z.string().nullable().optional(),
  diagnosis: z.string().nullable().optional(),
  doctor_advice: z.string().nullable().optional(),
  follow_up: z.string().nullable().optional(),
  medicines: z.array(extractedMedicineItemSchema).default([]),
  tests_ordered: z.array(extractedTestOrderItemSchema).default([]),
}));

export type ExtractPrescriptionRequest = z.infer<typeof extractPrescriptionRequestSchema>;
export type ExtractPrescriptionResponse = z.infer<typeof extractPrescriptionResponseSchema>;

// ==========================================
// 2. Lab Report Extraction Schemas
// ==========================================
export const extractLabReportRequestSchema = z.object({
  images: z
    .array(
      z.object({
        mimeType: z.string(),
        dataBase64: z.string().min(1),
      })
    )
    .min(1)
    .max(10),
});

export const extractedReportResultItemSchema = z.preprocess((val: any) => {
  if (typeof val === 'object' && val !== null) {
    const test_name = val.test_name || val.name || val.parameter || val.test || 'Lab Test';
    const value_text = val.value_text || val.value || val.result || '';
    const unit = val.unit || val.units || null;
    const reference_range = val.reference_range || val.range || val.normal_range || val.ref_range || null;
    const confidence = val.confidence === 'low' ? 'low' : 'high';
    return {
      test_name: String(test_name),
      value_text: String(value_text),
      unit: unit ? String(unit) : null,
      reference_range: reference_range ? String(reference_range) : null,
      confidence,
    };
  }
  return val;
}, z.object({
  test_name: z.string(),
  value_text: z.string(),
  unit: z.string().nullable().optional(),
  reference_range: z.string().nullable().optional(),
  confidence: z.enum(['high', 'low']).default('high'),
}));

export const extractLabReportResponseSchema = z.preprocess((val: any) => {
  if (typeof val === 'object' && val !== null) {
    return {
      ...val,
      readable: val.readable ?? true,
      results: Array.isArray(val.results) ? val.results : [],
    };
  }
  return val;
}, z.object({
  readable: z.boolean(),
  title: z.string().nullable().optional(),
  lab_name: z.string().nullable().optional(),
  report_date: z.string().nullable().optional(),
  results: z.array(extractedReportResultItemSchema).default([]),
}));

export type ExtractLabReportRequest = z.infer<typeof extractLabReportRequestSchema>;
export type ExtractLabReportResponse = z.infer<typeof extractLabReportResponseSchema>;

// ==========================================
// 3. Explain Medicine Schemas
// ==========================================
export const explainMedicineRequestSchema = z.object({
  medicine_name: z.string().min(1),
});

export const explainMedicineResponseSchema = z.object({
  medicine_name: z.string(),
  summary: z.string(),
  purpose: z.string(),
  common_instructions: z.string(),
});

export type ExplainMedicineRequest = z.infer<typeof explainMedicineRequestSchema>;
export type ExplainMedicineResponse = z.infer<typeof explainMedicineResponseSchema>;

// ==========================================
// 4. Drug Interactions Schemas
// ==========================================
export const checkInteractionsRequestSchema = z.object({
  medicines: z.array(z.string()).min(2),
});

export const interactionItemSchema = z.object({
  medicine_a: z.string(),
  medicine_b: z.string(),
  severity: z.enum(['mild', 'moderate', 'severe']),
  description: z.string(),
  recommendation: z.string(),
});

export const checkInteractionsResponseSchema = z.object({
  has_significant_interactions: z.boolean(),
  interactions: z.array(interactionItemSchema).default([]),
});

export type CheckInteractionsRequest = z.infer<typeof checkInteractionsRequestSchema>;
export type CheckInteractionsResponse = z.infer<typeof checkInteractionsResponseSchema>;
