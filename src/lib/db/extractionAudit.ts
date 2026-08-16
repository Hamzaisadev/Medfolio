import { supabase } from '../supabase/client';
import type { Tables, InsertTables } from '../supabase/types';

export type ExtractionAudit = Tables<'extraction_audit'>;
export type ExtractionAuditInsert = InsertTables<'extraction_audit'>;

export async function logExtractionAudit(entry: ExtractionAuditInsert): Promise<ExtractionAudit> {
  const { data, error } = await supabase
    .from('extraction_audit')
    .insert(entry)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getAuditForEntity(
  entityType: 'visit' | 'report',
  entityId: string
): Promise<ExtractionAudit[]> {
  const { data, error } = await supabase
    .from('extraction_audit')
    .select('*')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}
