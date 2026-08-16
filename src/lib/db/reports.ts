import { supabase } from '../supabase/client';
import type { Tables, InsertTables, UpdateTables } from '../supabase/types';
import { getLocalItems, insertLocalItem, updateLocalItem, deleteLocalItem, newId } from './localStore';
import { getWithFallback, insertWithFallback, listWithFallback } from './offlineFallback';

export type Report = Tables<'reports'>;
export type ReportInsert = InsertTables<'reports'>;
export type ReportUpdate = UpdateTables<'reports'>;
export type ReportImage = Tables<'report_images'>;
export type ReportResult = Tables<'report_results'>;
/** Convenience alias used by clinical domain engines */
export type LabResult = ReportResult;

export async function listReports(profileId: string): Promise<Report[]> {
  return listWithFallback<Report>(
    'listReports',
    'reports',
    () =>
      supabase
        .from('reports')
        .select('*')
        .eq('profile_id', profileId)
        .order('report_date', { ascending: false }),
    (items) => items.filter((r) => r.profile_id === profileId)
  );
}

export async function getReportById(id: string): Promise<Report | null> {
  return getWithFallback<Report>(
    'getReportById',
    'reports',
    () => supabase.from('reports').select('*').eq('id', id).maybeSingle(),
    (items) => items.find((r) => r.id === id)
  );
}

export async function createReport(report: ReportInsert): Promise<Report> {
  const payload: ReportInsert = {
    ...report,
    currency: report.currency || 'PKR',
    source_type: report.source_type || 'manual',
  };

  return insertWithFallback<Report>(
    'createReport',
    'reports',
    () => supabase.from('reports').insert(payload).select().single(),
    () =>
      ({
        ...payload,
        id: payload.id || newId(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }) as Report
  );
}

export async function updateReport(id: string, updates: ReportUpdate): Promise<Report> {
  try {
    const { data, error } = await supabase
      .from('reports')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    if (data) return data;
  } catch (err) {
    console.warn('updateReport failed, updating local store:', err);
  }

  const localUpdated = updateLocalItem<Report>('reports', id, updates as Partial<Report>);
  if (!localUpdated) throw new Error(`No report found with id ${id}.`);
  return localUpdated;
}

export async function deleteReport(id: string): Promise<void> {
  const { error } = await supabase.from('reports').delete().eq('id', id);
  if (error) {
    throw new Error(`Could not delete this report: ${error.message}`);
  }
  deleteLocalItem('reports', id);
}

export async function addReportResults(
  results: InsertTables<'report_results'>[]
): Promise<ReportResult[]> {
  if (results.length === 0) return [];

  const payload = results.map((res) => ({
    ...res,
    range_status: res.range_status || 'unknown',
  }));

  try {
    const { data, error } = await supabase.from('report_results').insert(payload).select();
    if (error) throw new Error(error.message);
    if (data) return data;
  } catch (err) {
    console.warn('addReportResults failed, saving to local store:', err);
  }

  return payload.map((res) =>
    insertLocalItem<ReportResult>('report_results', {
      ...res,
      id: res.id || newId(),
      created_at: new Date().toISOString(),
    } as ReportResult)
  );
}

export async function listResultsForReport(reportId: string): Promise<ReportResult[]> {
  return listWithFallback<ReportResult>(
    'listResultsForReport',
    'report_results',
    () =>
      supabase
        .from('report_results')
        .select('*')
        .eq('report_id', reportId)
        .order('created_at', { ascending: true }),
    (items) => items.filter((r) => r.report_id === reportId)
  );
}

export async function listResultsByCanonicalName(
  userId: string,
  canonicalName: string
): Promise<ReportResult[]> {
  return listWithFallback<ReportResult>(
    'listResultsByCanonicalName',
    'report_results',
    () =>
      supabase
        .from('report_results')
        .select('*')
        .eq('user_id', userId)
        .eq('canonical_name', canonicalName)
        .order('created_at', { ascending: true }),
    // Scope the local fallback by user too, so a trend chart cannot mix in
    // another profile's results.
    (items) =>
      items.filter((r) => r.canonical_name === canonicalName && r.user_id === userId)
  );
}

/** Exposed for tests and diagnostics. */
export function localReportResults(): ReportResult[] {
  return getLocalItems<ReportResult>('report_results');
}

/** Convenience alias for domain engines */
export const getReportResults = listResultsForReport;
