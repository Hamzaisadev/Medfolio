import type {
  ExtractPrescriptionRequest,
  ExtractPrescriptionResponse,
  ExtractLabReportRequest,
  ExtractLabReportResponse,
  ExplainMedicineRequest,
  ExplainMedicineResponse,
} from '../../../api/_lib/schemas';
import { supabase } from '../supabase/client';

export interface ExtractionResult<T> {
  data: T;
  raw_response: unknown;
  model: string;
}

/**
 * Calls POST /api/extract-prescription with session authorization and optimized images.
 */
export async function extractPrescription(
  payload: ExtractPrescriptionRequest
): Promise<ExtractionResult<ExtractPrescriptionResponse>> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token || '';

  const res = await fetch('/api/extract-prescription', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorJson = await res.json().catch(() => ({}));
    throw new Error(
      errorJson.error ||
        (res.status === 429
          ? 'Rate limit reached. Please wait a moment.'
          : "Couldn't read prescription right now. Try again, or enter details yourself.")
    );
  }

  return await res.json();
}

/**
 * Calls POST /api/extract-lab-report.
 */
export async function extractLabReport(
  payload: ExtractLabReportRequest
): Promise<ExtractionResult<ExtractLabReportResponse>> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token || '';

  const res = await fetch('/api/extract-lab-report', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorJson = await res.json().catch(() => ({}));
    throw new Error(
      errorJson.error || "Couldn't read lab report right now. Try again, or enter details manually."
    );
  }

  return await res.json();
}

/**
 * Calls POST /api/explain-medicine with persistent client caching in localStorage.
 */
export async function explainMedicine(
  payload: ExplainMedicineRequest
): Promise<ExplainMedicineResponse> {
  const cacheKey = `med_expl_${payload.medicine_name.toLowerCase().trim()}`;
  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch {
    // Ignore localStorage errors
  }

  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token || '';

  const res = await fetch('/api/explain-medicine', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorJson = await res.json().catch(() => ({}));
    throw new Error(
      errorJson.error || "Could not retrieve plain-language explanation for this medication."
    );
  }

  const result: ExtractionResult<ExplainMedicineResponse> = await res.json();
  try {
    localStorage.setItem(cacheKey, JSON.stringify(result.data));
  } catch {
    // Ignore quota issues
  }

  return result.data;
}
