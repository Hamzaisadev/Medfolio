import { supabase } from '../supabase/client';
import type { Tables, InsertTables, UpdateTables } from '../supabase/types';
import { updateLocalItem, newId } from './localStore';
import { insertWithFallback, listWithFallback } from './offlineFallback';

export type TestOrder = Tables<'test_orders'>;
export type TestOrderInsert = InsertTables<'test_orders'>;
export type TestOrderUpdate = UpdateTables<'test_orders'>;

export async function listTestOrders(profileId: string): Promise<TestOrder[]> {
  return listWithFallback<TestOrder>(
    'listTestOrders',
    'test_orders',
    () =>
      supabase
        .from('test_orders')
        .select('*')
        .eq('profile_id', profileId)
        .order('ordered_date', { ascending: false }),
    (items) => items.filter((o) => o.profile_id === profileId)
  );
}

export async function listPendingTestOrders(profileId: string): Promise<TestOrder[]> {
  return listWithFallback<TestOrder>(
    'listPendingTestOrders',
    'test_orders',
    () =>
      supabase
        .from('test_orders')
        .select('*')
        .eq('profile_id', profileId)
        .eq('status', 'pending')
        .order('ordered_date', { ascending: false }),
    (items) => items.filter((o) => o.profile_id === profileId && o.status === 'pending')
  );
}

export async function createTestOrder(order: TestOrderInsert): Promise<TestOrder> {
  const payload: TestOrderInsert = {
    ...order,
    status: order.status || 'pending',
    currency: order.currency || 'PKR',
  };

  return insertWithFallback<TestOrder>(
    'createTestOrder',
    'test_orders',
    () => supabase.from('test_orders').insert(payload).select().single(),
    () =>
      ({
        ...payload,
        id: payload.id || newId(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }) as TestOrder
  );
}

export async function updateTestOrder(id: string, updates: TestOrderUpdate): Promise<TestOrder> {
  try {
    const { data, error } = await supabase
      .from('test_orders')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    if (data) return data;
  } catch (err) {
    console.warn('updateTestOrder failed, updating local store:', err);
  }

  const localUpdated = updateLocalItem<TestOrder>('test_orders', id, updates as Partial<TestOrder>);
  if (!localUpdated) throw new Error(`No test order found with id ${id}.`);
  return localUpdated;
}

export async function linkTestOrderToReport(
  id: string,
  reportId: string,
  method: 'auto' | 'manual',
  completedDate: string
): Promise<TestOrder> {
  return updateTestOrder(id, {
    report_id: reportId,
    status: 'completed',
    link_method: method,
    completed_date: completedDate,
  });
}
