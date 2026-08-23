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
 * Client cache for medicine explanations.
 *
 * Versioned and time-limited: the previous cache never expired, so AI-generated
 * medical content persisted in localStorage indefinitely and could not be
 * corrected by a prompt or model change.
 */
const EXPLAIN_CACHE_PREFIX = 'medfolio_med_expl_v2_';
const EXPLAIN_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

interface CachedExplanation {
  savedAt: number;
  data: ExplainMedicineResponse;
}

function explainCacheKey(medicineName: string): string {
  return `${EXPLAIN_CACHE_PREFIX}${medicineName.toLowerCase().trim()}`;
}

function readExplainCache(medicineName: string): ExplainMedicineResponse | null {
  try {
    const raw = localStorage.getItem(explainCacheKey(medicineName));
    if (!raw) return null;

    const cached = JSON.parse(raw) as CachedExplanation;
    if (!cached?.data || typeof cached.savedAt !== 'number') return null;
    if (Date.now() - cached.savedAt > EXPLAIN_CACHE_TTL_MS) {
      localStorage.removeItem(explainCacheKey(medicineName));
      return null;
    }
    return cached.data;
  } catch {
    return null;
  }
}

/**
 * Calls POST /api/explain-medicine with persistent client caching in localStorage.
 */
export async function explainMedicine(
  payload: ExplainMedicineRequest
): Promise<ExplainMedicineResponse> {
  const cached = readExplainCache(payload.medicine_name);
  if (cached) return cached;

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
    const entry: CachedExplanation = { savedAt: Date.now(), data: result.data };
    localStorage.setItem(explainCacheKey(payload.medicine_name), JSON.stringify(entry));
  } catch {
    // Ignore quota issues
  }

  return result.data;
}
