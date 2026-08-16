import { z } from 'zod';

export const EXPORT_FORMAT_IDENTIFIER = 'medfolio.export';
export const CURRENT_EXPORT_VERSION = 1;

export const profileExportSchema = z.object({
  id: z.string().uuid(),
  full_name: z.string().min(1),
  relationship: z.enum(['self', 'parent', 'child', 'spouse', 'other']),
  date_of_birth: z.string().nullable().optional(),
  sex: z.enum(['male', 'female', 'other', 'undisclosed']).nullable().optional(),
  blood_group: z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'unknown']).nullable().optional(),
  height_cm: z.number().nullable().optional(),
  weight_kg: z.number().nullable().optional(),
  allergies: z.string().nullable().optional(),
  chronic_conditions: z.string().nullable().optional(),
  emergency_contact_name: z.string().nullable().optional(),
  emergency_contact_phone: z.string().nullable().optional(),
  is_default: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const visitExportSchema = z.object({
  id: z.string().uuid(),
  profile_id: z.string().uuid(),
  visit_date: z.string(),
  doctor_name: z.string().nullable().optional(),
  clinic_name: z.string().nullable().optional(),
  specialty: z.string().nullable().optional(),
  diagnosis: z.string().nullable().optional(),
  doctor_advice: z.string().nullable().optional(),
  follow_up_date: z.string().nullable().optional(),
  visit_cost: z.number().nullable().optional(),
  currency: z.string(),
  notes: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const medicineExportSchema = z.object({
  id: z.string().uuid(),
  profile_id: z.string().uuid(),
  visit_id: z.string().uuid().nullable().optional(),
  medicine_name: z.string().min(1),
  strength: z.string().nullable().optional(),
  form: z.string().nullable().optional(),
  dose_amount: z.string().nullable().optional(),
  frequency_raw: z.string().nullable().optional(),
  frequency_code: z.enum(['OD', 'BD', 'TDS', 'QID', 'QHS', 'PRN', 'SOS', 'STAT', 'WEEKLY', 'CUSTOM']).nullable().optional(),
  duration_raw: z.string().nullable().optional(),
  duration_days: z.number().nullable().optional(),
  start_date: z.string(),
  end_date: z.string().nullable().optional(),
  instructions: z.string().nullable().optional(),
  with_food: z.boolean().nullable().optional(),
  is_ongoing: z.boolean(),
  is_otc: z.boolean(),
  unit_cost: z.number().nullable().optional(),
  currency: z.string(),
  discontinued_at: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const doseExportSchema = z.object({
  id: z.string().uuid(),
  profile_id: z.string().uuid(),
  medicine_id: z.string().uuid(),
  scheduled_date: z.string(),
  scheduled_minutes: z.number().min(0).max(1439),
  status: z.enum(['pending', 'taken', 'skipped', 'missed']),
  taken_at: z.string().nullable().optional(),
  skipped_reason: z.string().nullable().optional(),
  snoozed_until: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const testOrderExportSchema = z.object({
  id: z.string().uuid(),
  profile_id: z.string().uuid(),
  visit_id: z.string().uuid().nullable().optional(),
  test_name: z.string().min(1),
  canonical_name: z.string().nullable().optional(),
  status: z.enum(['pending', 'scheduled', 'completed', 'cancelled']),
  ordered_date: z.string(),
  scheduled_date: z.string().nullable().optional(),
  completed_date: z.string().nullable().optional(),
  report_id: z.string().uuid().nullable().optional(),
  link_method: z.enum(['auto', 'manual']).nullable().optional(),
  estimated_cost: z.number().nullable().optional(),
  currency: z.string(),
  notes: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const reportExportSchema = z.object({
  id: z.string().uuid(),
  profile_id: z.string().uuid(),
  title: z.string().min(1),
  report_date: z.string(),
  lab_name: z.string().nullable().optional(),
  report_cost: z.number().nullable().optional(),
  currency: z.string(),
  source_type: z.enum(['image', 'pdf', 'manual']),
  notes: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const reportResultExportSchema = z.object({
  id: z.string().uuid(),
  report_id: z.string().uuid(),
  test_name: z.string().min(1),
  canonical_name: z.string().nullable().optional(),
  value_text: z.string(),
  value_numeric: z.number().nullable().optional(),
  unit: z.string().nullable().optional(),
  reference_range: z.string().nullable().optional(),
  ref_low: z.number().nullable().optional(),
  ref_high: z.number().nullable().optional(),
  range_status: z.enum(['within', 'below', 'above', 'unknown']),
  created_at: z.string(),
});

export const sideEffectExportSchema = z.object({
  id: z.string().uuid(),
  profile_id: z.string().uuid(),
  medicine_id: z.string().uuid().nullable().optional(),
  medicine_name: z.string().min(1),
  note: z.string().min(1),
  severity: z.enum(['mild', 'moderate', 'severe']).nullable().optional(),
  occurred_at: z.string(),
  created_at: z.string(),
});

export const reminderSettingsExportSchema = z.object({
  id: z.string().uuid(),
  profile_id: z.string().uuid(),
  enabled: z.boolean(),
  quiet_hours_start: z.number().min(0).max(1439).nullable().optional(),
  quiet_hours_end: z.number().min(0).max(1439).nullable().optional(),
  snooze_minutes: z.number().min(1).max(120),
  lead_minutes: z.number().min(0),
  created_at: z.string(),
  updated_at: z.string(),
});

export const imageExportSchema = z.object({
  path: z.string().min(1),
  data_base64: z.string().min(1),
});

export const medfolioExportDocumentSchema = z.object({
  format: z.literal(EXPORT_FORMAT_IDENTIFIER),
  version: z.literal(CURRENT_EXPORT_VERSION),
  exported_at: z.string(),
  app_timezone: z.literal('Asia/Karachi'),
  profiles: z.array(profileExportSchema).default([]),
  visits: z.array(visitExportSchema).default([]),
  medicines: z.array(medicineExportSchema).default([]),
  doses: z.array(doseExportSchema).default([]),
  test_orders: z.array(testOrderExportSchema).default([]),
  reports: z.array(reportExportSchema).default([]),
  report_results: z.array(reportResultExportSchema).default([]),
  side_effects: z.array(sideEffectExportSchema).default([]),
  reminder_settings: z.array(reminderSettingsExportSchema).default([]),
  images: z.array(imageExportSchema).default([]),
});

export type MedfolioExportDocument = z.infer<typeof medfolioExportDocumentSchema>;

/**
 * Validates an unknown JSON payload against the Medfolio Export specification.
 * Returns formatted errors if validation fails.
 */
export function validateExportDocument(data: unknown): {
  success: boolean;
  data?: MedfolioExportDocument;
  error?: string;
} {
  const result = medfolioExportDocumentSchema.safeParse(data);
  if (!result.success) {
    const firstIssue = result.error.issues[0];
    const pathStr = firstIssue ? firstIssue.path.join('.') : 'root';
    const message = firstIssue ? firstIssue.message : 'Invalid structure';
    return {
      success: false,
      error: `Validation error at '${pathStr}': ${message}`,
    };
  }

  return {
    success: true,
    data: result.data,
  };
}
