import { todayInAppTz } from './time';

export interface HealthExpenseItem {
  id: string;
  category: 'doctor' | 'medicine' | 'lab' | 'other';
  title: string;
  amount: number;
  currency: string;
  date: string;
  note?: string;
}

export function getExpenseStorageKey(profileId: string): string {
  return `medfolio_health_expenses_v1_${profileId || 'default'}`;
}

export function listHealthExpenses(profileId: string): HealthExpenseItem[] {
  try {
    const raw = localStorage.getItem(getExpenseStorageKey(profileId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function recordMedicinePurchaseExpense({
  profileId,
  medicineName,
  amount,
  currency = 'PKR',
  quantity,
  date = todayInAppTz(),
  note,
}: {
  profileId: string;
  medicineName: string;
  amount: number;
  currency?: string;
  quantity?: number | string;
  date?: string;
  note?: string;
}): void {
  if (!amount || amount <= 0) return;

  try {
    const key = getExpenseStorageKey(profileId);
    const existing = listHealthExpenses(profileId);
    const quantityStr = quantity ? ` (${quantity} units)` : '';

    const newExpense: HealthExpenseItem = {
      id: `purchase-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      category: 'medicine',
      title: `Medication Purchase: ${medicineName}${quantityStr}`,
      amount,
      currency,
      date,
      note: note || 'Recorded from cabinet refill / pharmacy purchase',
    };

    existing.unshift(newExpense);
    localStorage.setItem(key, JSON.stringify(existing));
  } catch (err) {
    console.error('Failed to log medicine purchase expense:', err);
  }
}
