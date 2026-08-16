import { useState, useEffect, useMemo } from 'react';
import { AppShell } from '../../components/layout/AppShell';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Toast } from '../../components/ui/Toast';
import { EmptyState } from '../../components/ui/EmptyState';
import { visitsRepo, medicinesRepo, reportsRepo } from '../../lib/db';
import { todayInAppTz } from '../../lib/time';

export interface HealthExpenseItem {
  id: string;
  category: 'doctor' | 'medicine' | 'lab' | 'other';
  title: string;
  amount: number;
  currency: string;
  date: string;
  note?: string;
}

const EXPENSE_STORAGE_KEY = 'medfolio_health_expenses_v1';

import { useAuth } from '../../lib/auth/AuthContext';

export function FinancePage() {
  const { user, profile } = useAuth();
  const [expenses, setExpenses] = useState<HealthExpenseItem[]>(() => {
    try {
      const saved = localStorage.getItem(EXPENSE_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [isLoading, setIsLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Add Expense Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<'doctor' | 'medicine' | 'lab' | 'other'>('doctor');
  const [newAmount, setNewAmount] = useState('');
  const [newDate, setNewDate] = useState(todayInAppTz());
  const [newNote, setNewNote] = useState('');

  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const effectiveUserId = user?.id || profile?.user_id || '';
  const effectiveProfileId = profile?.id || effectiveUserId;

  useEffect(() => {
    async function loadData() {
      if (!effectiveUserId) return;
      setIsLoading(true);
      try {
        const [vList] = await Promise.all([
          visitsRepo.listVisits(effectiveProfileId),
          medicinesRepo.listMedicines(effectiveUserId),
          reportsRepo.listReports(effectiveUserId),
        ]);

        // Auto-sync doctor visit fees from visits table if not already logged
        const synced: HealthExpenseItem[] = [...expenses];
        let hasChanges = false;

        for (const v of vList) {
          if (v.visit_cost && v.visit_cost > 0) {
            const exists = synced.some((e) => e.id === `visit-${v.id}`);
            if (!exists) {
              synced.push({
                id: `visit-${v.id}`,
                category: 'doctor',
                title: `Consultation Fee — Dr. ${v.doctor_name || 'Physician'}`,
                amount: Number(v.visit_cost),
                currency: v.currency || 'PKR',
                date: v.visit_date,
                note: v.clinic_name || v.diagnosis || undefined,
              });
              hasChanges = true;
            }
          }
        }

        if (hasChanges) {
          setExpenses(synced);
          localStorage.setItem(EXPENSE_STORAGE_KEY, JSON.stringify(synced));
        }
      } catch (err) {
        console.error('Failed to load financial records:', err);
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveExpenses = (newList: HealthExpenseItem[]) => {
    setExpenses(newList);
    try {
      localStorage.setItem(EXPENSE_STORAGE_KEY, JSON.stringify(newList));
    } catch (err) {
      console.error('Failed to save expenses:', err);
    }
  };

  const handleAddExpense = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(newAmount);
    if (!newTitle.trim() || isNaN(amt) || amt <= 0) return;

    const item: HealthExpenseItem = {
      id: `exp-${Date.now()}`,
      category: newCategory,
      title: newTitle.trim(),
      amount: amt,
      currency: 'PKR',
      date: newDate,
      note: newNote.trim() || undefined,
    };

    const updated = [item, ...expenses];
    saveExpenses(updated);
    setIsModalOpen(false);
    setNewTitle('');
    setNewAmount('');
    setNewNote('');
    setToastMessage(`Logged ${item.currency} ${item.amount.toLocaleString()} for ${item.title}.`);
  };

  const handleDeleteExpense = (id: string) => {
    const updated = expenses.filter((e) => e.id !== id);
    saveExpenses(updated);
    setToastMessage('Expense record removed.');
  };

  // Financial Analytics Calculations
  const currentMonthPrefix = todayInAppTz().slice(0, 7); // 'YYYY-MM'

  const totalSpent = useMemo(() => {
    return expenses.reduce((acc, curr) => acc + curr.amount, 0);
  }, [expenses]);

  const thisMonthSpent = useMemo(() => {
    return expenses
      .filter((e) => e.date.startsWith(currentMonthPrefix))
      .reduce((acc, curr) => acc + curr.amount, 0);
  }, [expenses, currentMonthPrefix]);

  const doctorFeesTotal = useMemo(() => {
    return expenses.filter((e) => e.category === 'doctor').reduce((acc, curr) => acc + curr.amount, 0);
  }, [expenses]);

  const medicineCostsTotal = useMemo(() => {
    return expenses.filter((e) => e.category === 'medicine').reduce((acc, curr) => acc + curr.amount, 0);
  }, [expenses]);

  const labTestsTotal = useMemo(() => {
    return expenses.filter((e) => e.category === 'lab').reduce((acc, curr) => acc + curr.amount, 0);
  }, [expenses]);

  // Monthly breakdown for chart (last 6 months)
  const monthlyBuckets = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of expenses) {
      const month = e.date.slice(0, 7);
      map[month] = (map[month] || 0) + e.amount;
    }
    return Object.entries(map)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-6);
  }, [expenses]);

  const maxMonthValue = Math.max(...monthlyBuckets.map((b) => b[1]), 1000);

  // Filtered expense ledger
  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      if (filterCategory !== 'all' && e.category !== filterCategory) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          e.title.toLowerCase().includes(q) ||
          (e.note && e.note.toLowerCase().includes(q)) ||
          e.date.includes(q)
        );
      }
      return true;
    });
  }, [expenses, filterCategory, searchQuery]);

  return (
    <AppShell>
      <div className="space-y-6 max-w-5xl mx-auto">
        <PageHeader
          title="Healthcare Financial & Expense Tracker"
          description="Track and analyze total medical expenses across doctor consultation fees, pharmacy prescriptions, and diagnostic lab tests."
          action={
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsModalOpen(true)}
              className="font-bold shadow-xs flex items-center gap-1.5"
            >
              <span>➕</span>
              <span>Log Health Expense</span>
            </Button>
          }
        />

        <Toast
          open={Boolean(toastMessage)}
          onClose={() => setToastMessage(null)}
          message={toastMessage || ''}
          tone="ok"
        />

        {/* Top KPI Financial Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          <Card className="p-4 bg-teal-900 text-white rounded-2xl shadow-xs border-teal-800">
            <span className="text-teal-300 text-xs font-bold block">Total Medical Spend</span>
            <div className="text-xl sm:text-2xl font-black mt-1">
              PKR {totalSpent.toLocaleString()}
            </div>
            <span className="text-teal-400 text-[11px] block mt-0.5">All-time tracked records</span>
          </Card>

          <Card className="p-4 bg-white border border-ink-200 rounded-2xl shadow-xs">
            <span className="text-ink-500 text-xs font-bold block">This Month's Expenses</span>
            <div className="text-xl sm:text-2xl font-black text-ink-900 mt-1">
              PKR {thisMonthSpent.toLocaleString()}
            </div>
            <span className="text-ink-400 text-[11px] block mt-0.5">{currentMonthPrefix}</span>
          </Card>

          <Card className="p-4 bg-white border border-ink-200 rounded-2xl shadow-xs">
            <span className="text-ink-500 text-xs font-bold block">👨‍⚕️ Doctor Consultation Fees</span>
            <div className="text-xl sm:text-2xl font-black text-teal-900 mt-1">
              PKR {doctorFeesTotal.toLocaleString()}
            </div>
            <span className="text-ink-400 text-[11px] block mt-0.5">
              {totalSpent > 0 ? `${Math.round((doctorFeesTotal / totalSpent) * 100)}% of total spend` : '0%'}
            </span>
          </Card>

          <Card className="p-4 bg-white border border-ink-200 rounded-2xl shadow-xs">
            <span className="text-ink-500 text-xs font-bold block">💊 Medicines & Pharmacy</span>
            <div className="text-xl sm:text-2xl font-black text-purple-900 mt-1">
              PKR {medicineCostsTotal.toLocaleString()}
            </div>
            <span className="text-ink-400 text-[11px] block mt-0.5">
              {totalSpent > 0 ? `${Math.round((medicineCostsTotal / totalSpent) * 100)}% of total spend` : '0%'}
            </span>
          </Card>
        </div>

        {/* Category Breakdown & Monthly Trend Graph */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Category Distribution Meters */}
          <Card header={<h3 className="text-sm font-bold text-ink-900">Spending by Category</h3>}>
            <div className="space-y-4 pt-1">
              {/* Doctor Fees */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-ink-800">👨‍⚕️ Doctor Consultations</span>
                  <span className="font-bold text-ink-900">PKR {doctorFeesTotal.toLocaleString()}</span>
                </div>
                <div className="w-full bg-ink-100 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-teal-600 h-full rounded-full transition-all"
                    style={{ width: `${totalSpent > 0 ? (doctorFeesTotal / totalSpent) * 100 : 0}%` }}
                  />
                </div>
              </div>

              {/* Medicine Costs */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-ink-800">💊 Pharmacy & Refills</span>
                  <span className="font-bold text-ink-900">PKR {medicineCostsTotal.toLocaleString()}</span>
                </div>
                <div className="w-full bg-ink-100 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-purple-600 h-full rounded-full transition-all"
                    style={{ width: `${totalSpent > 0 ? (medicineCostsTotal / totalSpent) * 100 : 0}%` }}
                  />
                </div>
              </div>

              {/* Lab Diagnostics */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-ink-800">🧪 Lab Tests & Diagnostics</span>
                  <span className="font-bold text-ink-900">PKR {labTestsTotal.toLocaleString()}</span>
                </div>
                <div className="w-full bg-ink-100 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-blue-600 h-full rounded-full transition-all"
                    style={{ width: `${totalSpent > 0 ? (labTestsTotal / totalSpent) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </div>
          </Card>

          {/* Monthly Spending Trend Bar Graph */}
          <Card className="md:col-span-2" header={<h3 className="text-sm font-bold text-ink-900">Monthly Medical Expenditure Trend</h3>}>
            {monthlyBuckets.length === 0 ? (
              <p className="text-xs text-ink-400 italic py-8 text-center">
                Log your first expense or doctor visit fee to see monthly financial trends.
              </p>
            ) : (
              <div className="h-40 flex items-end justify-between gap-3 pt-4 px-2">
                {monthlyBuckets.map(([month, val]) => {
                  const heightPercent = Math.max(12, Math.round((val / maxMonthValue) * 100));
                  return (
                    <div key={month} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                      <span className="text-[10px] font-bold text-ink-700">PKR {Math.round(val / 1000)}k</span>
                      <div
                        className="w-full max-w-[48px] bg-teal-700 hover:bg-teal-800 rounded-t-lg transition-all shadow-xs"
                        style={{ height: `${heightPercent}%` }}
                        title={`${month}: PKR ${val.toLocaleString()}`}
                      />
                      <span className="text-[10px] text-ink-500 font-medium">{month}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        {/* Expense History Ledger */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <h2 className="text-base font-bold text-ink-900">Health Expenses Ledger ({filteredExpenses.length})</h2>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search expenses..."
                className="h-9 px-3 text-xs bg-white border border-ink-200 rounded-xl text-ink-900 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />

              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="h-9 px-2 text-xs bg-white border border-ink-200 rounded-xl text-ink-900 focus:outline-none"
              >
                <option value="all">All Categories</option>
                <option value="doctor">👨‍⚕️ Doctor Fees</option>
                <option value="medicine">💊 Medicines</option>
                <option value="lab">🧪 Lab Tests</option>
                <option value="other">🏥 Other</option>
              </select>
            </div>
          </div>

          {isLoading ? (
            <div className="py-12 text-center text-sm text-ink-500">Loading financial records...</div>
          ) : filteredExpenses.length === 0 ? (
            <EmptyState
              heading="No expenses recorded"
              description="Log prescription purchases, lab fees, or doctor visits to track your healthcare budget."
              action={
                <Button size="sm" onClick={() => setIsModalOpen(true)}>
                  + Log Health Expense
                </Button>
              }
            />
          ) : (
            <div className="bg-white border border-ink-200 rounded-2xl overflow-hidden shadow-xs">
              <div className="divide-y divide-ink-100 text-xs">
                {filteredExpenses.map((item) => (
                  <div key={item.id} className="p-3.5 flex items-center justify-between hover:bg-ink-50/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-ink-100 text-sm shrink-0">
                        {item.category === 'doctor' ? '👨‍⚕️' : item.category === 'medicine' ? '💊' : item.category === 'lab' ? '🧪' : '🏥'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-ink-900 text-sm">{item.title}</span>
                          <Badge
                            tone={item.category === 'doctor' ? 'ok' : item.category === 'medicine' ? 'info' : 'neutral'}
                            size="sm"
                          >
                            {item.category.toUpperCase()}
                          </Badge>
                        </div>
                        <div className="text-[11px] text-ink-500 flex items-center gap-2 mt-0.5">
                          <span>{item.date}</span>
                          {item.note && <span>• {item.note}</span>}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="font-bold text-sm text-ink-900">
                        PKR {item.amount.toLocaleString()}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDeleteExpense(item.id)}
                        className="text-ink-400 hover:text-red-600 font-bold p-1"
                        title="Delete expense"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Log Expense Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-5 space-y-4 shadow-xl animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-ink-900">Log Healthcare Expense</h3>
                <button type="button" onClick={() => setIsModalOpen(false)} className="text-ink-400 hover:text-ink-700 text-sm font-bold">
                  ✕
                </button>
              </div>

              <form onSubmit={handleAddExpense} className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-ink-700 mb-1">Expense Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Augmentin & Pan-D Refill / Dr. Farooq Consultation"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="w-full h-10 px-3 bg-ink-50 border border-ink-200 rounded-xl text-ink-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-semibold text-ink-700 mb-1">Category</label>
                    <select
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value as 'doctor' | 'medicine' | 'lab' | 'other')}
                      className="w-full h-10 px-2 bg-ink-50 border border-ink-200 rounded-xl text-ink-900 focus:outline-none"
                    >
                      <option value="doctor">👨‍⚕️ Doctor Fee</option>
                      <option value="medicine">💊 Medicine / Pharmacy</option>
                      <option value="lab">🧪 Diagnostic Lab Test</option>
                      <option value="other">🏥 Other Medical</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-ink-700 mb-1">Amount (PKR)</label>
                    <input
                      type="number"
                      required
                      min="1"
                      step="1"
                      placeholder="e.g. 2500"
                      value={newAmount}
                      onChange={(e) => setNewAmount(e.target.value)}
                      className="w-full h-10 px-3 bg-ink-50 border border-ink-200 rounded-xl text-ink-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-semibold text-ink-700 mb-1">Date</label>
                    <input
                      type="date"
                      required
                      value={newDate}
                      onChange={(e) => setNewDate(e.target.value)}
                      className="w-full h-10 px-3 bg-ink-50 border border-ink-200 rounded-xl text-ink-900 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-ink-700 mb-1">Note (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. South City Clinic"
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      className="w-full h-10 px-3 bg-ink-50 border border-ink-200 rounded-xl text-ink-900 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="pt-3 flex justify-end gap-2">
                  <Button variant="ghost" size="sm" type="button" onClick={() => setIsModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button variant="primary" size="sm" type="submit" className="font-bold">
                    Save Expense
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
