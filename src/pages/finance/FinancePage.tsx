import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { AppShell } from '../../components/layout/AppShell';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Select } from '../../components/ui/Select';
import { Toast } from '../../components/ui/Toast';
import { Dialog } from '../../components/ui/Dialog';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { Skeleton } from '../../components/ui/Skeleton';
import {
  DoctorIcon,
  MedicineIcon,
  LabFlaskIcon,
  HospitalIcon,
  PlusIcon,
  XIcon,
} from '../../components/ui/icons';
import { visitsRepo, medicinesRepo, reportsRepo } from '../../lib/db';
import { todayInAppTz } from '../../lib/time';
import { useAuth } from '../../lib/auth/AuthContext';

export interface HealthExpenseItem {
  id: string;
  category: 'doctor' | 'medicine' | 'lab' | 'other';
  title: string;
  amount: number;
  currency: string;
  date: string;
  note?: string;
}

/**
 * Category accent mapping on semantic tokens so the ledger, meters, and icons
 * stay legible in both light and dark themes.
 */
const CATEGORY_STYLES: Record<HealthExpenseItem['category'], { bar: string; icon: string }> = {
  doctor: { bar: 'bg-accent', icon: 'text-accent' },
  medicine: { bar: 'bg-info-text', icon: 'text-info-text' },
  lab: { bar: 'bg-ok-text', icon: 'text-ok-text' },
  other: { bar: 'bg-content-subtle', icon: 'text-content-muted' },
};

function getExpenseStorageKey(profileId: string): string {
  return `medfolio_health_expenses_v1_${profileId || 'default'}`;
}

export function FinancePage() {
  const { user, profile } = useAuth();
  const effectiveUserId = user?.id || profile?.user_id || '';
  const effectiveProfileId = profile?.id || effectiveUserId;

  const [expenses, setExpenses] = useState<HealthExpenseItem[]>(() => {
    try {
      const saved = localStorage.getItem(getExpenseStorageKey(profile?.id || ''));
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
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

  const loadData = useCallback(async () => {
    if (!effectiveUserId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setLoadError(null);
    try {
      const [vList, medList] = await Promise.all([
        visitsRepo.listVisits(effectiveProfileId),
        medicinesRepo.listMedicines(effectiveProfileId),
        reportsRepo.listReports(effectiveProfileId),
      ]);

      // Auto-sync doctor visit fees and medicine costs if not already logged
      setExpenses((prevExpenses) => {
        const synced: HealthExpenseItem[] = [...prevExpenses];
        let hasChanges = false;

        // 1. Doctor Visits
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

        // 2. Prescribed Medicines with Recorded Costs
        for (const m of medList) {
          if (m.unit_cost && m.unit_cost > 0) {
            const exists = synced.some((e) => e.id === `med-${m.id}`);
            if (!exists) {
              synced.push({
                id: `med-${m.id}`,
                category: 'medicine',
                title: `Medication — ${m.medicine_name}${m.strength ? ' ' + m.strength : ''}`,
                amount: Number(m.unit_cost),
                currency: m.currency || 'PKR',
                date: m.start_date || todayInAppTz(),
                note: m.instructions || undefined,
              });
              hasChanges = true;
            }
          }
        }

        if (hasChanges) {
          try {
            localStorage.setItem(getExpenseStorageKey(effectiveProfileId), JSON.stringify(synced));
          } catch {
            // ignore
          }
          return synced;
        }
        return prevExpenses;
      });
    } catch (err) {
      console.error('Failed to load financial records:', err);
      setLoadError(
        'Could not sync doctor visit and medicine costs. Your saved expenses are still shown below.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [effectiveProfileId, effectiveUserId]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(getExpenseStorageKey(effectiveProfileId));
      if (saved) setExpenses(JSON.parse(saved));
    } catch {
      // ignore
    }
    loadData();
  }, [effectiveProfileId, loadData]);

  const saveExpenses = (newList: HealthExpenseItem[]) => {
    setExpenses(newList);
    try {
      localStorage.setItem(getExpenseStorageKey(effectiveProfileId), JSON.stringify(newList));
    } catch (err) {
      console.error('Failed to save expenses:', err);
    }
  };

  const handleAddExpense = (e: FormEvent) => {
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
              leftIcon={<PlusIcon size={14} />}
            >
              Log Health Expense
            </Button>
          }
        />

        <Toast
          open={Boolean(toastMessage)}
          onClose={() => setToastMessage(null)}
          message={toastMessage || ''}
          tone="ok"
        />

        {loadError && (
          <ErrorState
            compact
            title="Cost sync failed"
            message={loadError}
            onRetry={loadData}
          />
        )}

        {/* Top KPI Financial Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          <Card className="p-4 bg-accent text-content-onaccent rounded-2xl shadow-xs border-accent-active">
            <span className="text-content-onaccent/80 text-xs font-bold block">Total Medical Spend</span>
            <div className="text-xl sm:text-2xl font-black mt-1">
              PKR {totalSpent.toLocaleString()}
            </div>
            <span className="text-content-onaccent/70 text-2xs block mt-0.5">All-time tracked records</span>
          </Card>

          <Card className="p-4 bg-surface border border-line rounded-2xl shadow-xs">
            <span className="text-content-muted text-xs font-bold block">This month&apos;s expenses</span>
            <div className="text-xl sm:text-2xl font-black text-content mt-1">
              PKR {thisMonthSpent.toLocaleString()}
            </div>
            <span className="text-content-subtle text-2xs block mt-0.5">{currentMonthPrefix}</span>
          </Card>

          <Card className="p-4 bg-surface border border-line rounded-2xl shadow-xs">
            <span className="text-content-muted text-xs font-bold flex items-center gap-1">
              <DoctorIcon size={14} className="text-accent" /> Doctor Consultation Fees
            </span>
            <div className="text-xl sm:text-2xl font-black text-content mt-1">
              PKR {doctorFeesTotal.toLocaleString()}
            </div>
            <span className="text-content-subtle text-2xs block mt-0.5">
              {totalSpent > 0 ? `${Math.round((doctorFeesTotal / totalSpent) * 100)}% of total spend` : '0%'}
            </span>
          </Card>

          <Card className="p-4 bg-surface border border-line rounded-2xl shadow-xs">
            <span className="text-content-muted text-xs font-bold flex items-center gap-1">
              <MedicineIcon size={14} className="text-info-text" /> Medicines & Pharmacy
            </span>
            <div className="text-xl sm:text-2xl font-black text-content mt-1">
              PKR {medicineCostsTotal.toLocaleString()}
            </div>
            <span className="text-content-subtle text-2xs block mt-0.5">
              {totalSpent > 0 ? `${Math.round((medicineCostsTotal / totalSpent) * 100)}% of total spend` : '0%'}
            </span>
          </Card>
        </div>

        {/* Category Breakdown & Monthly Trend Graph */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Category Distribution Meters */}
          <Card header={<h3 className="text-sm font-bold text-content">Spending by Category</h3>}>
            <div className="space-y-4 pt-1">
              {/* Doctor Fees */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-content flex items-center gap-1">
                    <DoctorIcon size={14} className={CATEGORY_STYLES.doctor.icon} /> Doctor Consultations
                  </span>
                  <span className="font-bold text-content">PKR {doctorFeesTotal.toLocaleString()}</span>
                </div>
                <div className="w-full bg-surface-sunken h-2 rounded-full overflow-hidden">
                  <div
                    className={`${CATEGORY_STYLES.doctor.bar} h-full rounded-full transition-all`}
                    style={{ width: `${totalSpent > 0 ? (doctorFeesTotal / totalSpent) * 100 : 0}%` }}
                  />
                </div>
              </div>

              {/* Medicine Costs */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-content flex items-center gap-1">
                    <MedicineIcon size={14} className={CATEGORY_STYLES.medicine.icon} /> Pharmacy & Refills
                  </span>
                  <span className="font-bold text-content">PKR {medicineCostsTotal.toLocaleString()}</span>
                </div>
                <div className="w-full bg-surface-sunken h-2 rounded-full overflow-hidden">
                  <div
                    className={`${CATEGORY_STYLES.medicine.bar} h-full rounded-full transition-all`}
                    style={{ width: `${totalSpent > 0 ? (medicineCostsTotal / totalSpent) * 100 : 0}%` }}
                  />
                </div>
              </div>

              {/* Lab Diagnostics */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-content flex items-center gap-1">
                    <LabFlaskIcon size={14} className={CATEGORY_STYLES.lab.icon} /> Lab Tests & Diagnostics
                  </span>
                  <span className="font-bold text-content">PKR {labTestsTotal.toLocaleString()}</span>
                </div>
                <div className="w-full bg-surface-sunken h-2 rounded-full overflow-hidden">
                  <div
                    className={`${CATEGORY_STYLES.lab.bar} h-full rounded-full transition-all`}
                    style={{ width: `${totalSpent > 0 ? (labTestsTotal / totalSpent) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </div>
          </Card>

          {/* Monthly Spending Trend Bar Graph */}
          <Card className="md:col-span-2" header={<h3 className="text-sm font-bold text-content">Monthly Medical Expenditure Trend</h3>}>
            {monthlyBuckets.length === 0 ? (
              <p className="text-xs text-content-subtle italic py-8 text-center">
                Log your first expense or doctor visit fee to see monthly financial trends.
              </p>
            ) : (
              <div className="h-40 flex items-end justify-between gap-3 pt-4 px-2">
                {monthlyBuckets.map(([month, val]) => {
                  const heightPercent = Math.max(12, Math.round((val / maxMonthValue) * 100));
                  return (
                    <div key={month} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                      <span className="text-2xs font-bold text-content-muted">PKR {Math.round(val / 1000)}k</span>
                      <div
                        className="w-full max-w-[48px] bg-accent hover:bg-accent-hover rounded-t-lg transition-all shadow-xs"
                        style={{ height: `${heightPercent}%` }}
                        title={`${month}: PKR ${val.toLocaleString()}`}
                      />
                      <span className="text-2xs text-content-subtle font-medium">{month}</span>
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
            <h2 className="text-base font-bold text-content">Health Expenses Ledger ({filteredExpenses.length})</h2>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search expenses..."
                aria-label="Search expenses"
                className="h-9 px-3 text-xs bg-surface border border-line rounded-xl text-content focus:outline-none focus:ring-1 focus:ring-accent"
              />

              <Select
                value={filterCategory}
                onValueChange={(val) => setFilterCategory(val)}
                aria-label="Filter by category"
                className="h-9 min-w-36 text-xs font-semibold"
                options={[
                  { value: 'all', label: 'All Categories' },
                  { value: 'doctor', label: 'Doctor Fees' },
                  { value: 'medicine', label: 'Medicines' },
                  { value: 'lab', label: 'Lab Tests' },
                  { value: 'other', label: 'Other Medical' },
                ]}
              />
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-2.5">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-14 w-full rounded-2xl" />
              ))}
            </div>
          ) : filteredExpenses.length === 0 ? (
            <EmptyState
              heading="No expenses recorded"
              description="Log prescription purchases, lab fees, or doctor visits to track your healthcare budget."
              action={
                <Button size="sm" onClick={() => setIsModalOpen(true)} leftIcon={<PlusIcon size={14} />}>
                  Log Health Expense
                </Button>
              }
            />
          ) : (
            <div className="bg-surface border border-line rounded-2xl overflow-hidden shadow-xs">
              <div className="divide-y divide-line text-xs">
                {filteredExpenses.map((item) => (
                  <div key={item.id} className="p-3.5 flex items-center justify-between hover:bg-surface-hover transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-surface-sunken shrink-0">
                        {item.category === 'doctor' ? (
                          <DoctorIcon size={16} className={CATEGORY_STYLES.doctor.icon} />
                        ) : item.category === 'medicine' ? (
                          <MedicineIcon size={16} className={CATEGORY_STYLES.medicine.icon} />
                        ) : item.category === 'lab' ? (
                          <LabFlaskIcon size={16} className={CATEGORY_STYLES.lab.icon} />
                        ) : (
                          <HospitalIcon size={16} className={CATEGORY_STYLES.other.icon} />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-content text-sm">{item.title}</span>
                          <Badge
                            tone={item.category === 'doctor' ? 'ok' : item.category === 'medicine' ? 'info' : 'neutral'}
                            size="sm"
                          >
                            {item.category.toUpperCase()}
                          </Badge>
                        </div>
                        <div className="text-2xs text-content-subtle flex items-center gap-2 mt-0.5">
                          <span>{item.date}</span>
                          {item.note && <span>• {item.note}</span>}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="font-bold text-sm text-content">
                        PKR {item.amount.toLocaleString()}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDeleteExpense(item.id)}
                        className="text-content-subtle hover:text-risk-text font-bold p-1 transition-colors"
                        title="Delete expense"
                        aria-label={`Delete expense: ${item.title}`}
                      >
                        <XIcon size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Log Expense Modal */}
        <Dialog
          open={isModalOpen}
          onOpenChange={setIsModalOpen}
          title="Log Healthcare Expense"
          description="Record a consultation fee, pharmacy purchase, or lab test cost."
        >
          <form onSubmit={handleAddExpense} className="space-y-3 text-xs mt-4">
            <div>
              <label htmlFor="exp-title" className="block font-semibold text-content-muted mb-1">Expense Title</label>
              <input
                id="exp-title"
                type="text"
                required
                placeholder="e.g. Augmentin & Pan-D Refill / Dr. Farooq Consultation"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full h-10 px-3 bg-surface-sunken border border-line rounded-xl text-content focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="exp-category" className="block font-semibold text-content-muted mb-1">Category</label>
                <Select
                  id="exp-category"
                  value={newCategory}
                  onValueChange={(val) => setNewCategory(val as 'doctor' | 'medicine' | 'lab' | 'other')}
                  className="h-10 text-xs font-bold"
                  options={[
                    { value: 'doctor', label: 'Doctor Fee' },
                    { value: 'medicine', label: 'Medicine / Pharmacy' },
                    { value: 'lab', label: 'Diagnostic Lab Test' },
                    { value: 'other', label: 'Other Medical' },
                  ]}
                />
              </div>

              <div>
                <label htmlFor="exp-amount" className="block font-semibold text-content-muted mb-1">Amount (PKR)</label>
                <input
                  id="exp-amount"
                  type="number"
                  required
                  min="1"
                  step="1"
                  placeholder="e.g. 2500"
                  value={newAmount}
                  onChange={(e) => setNewAmount(e.target.value)}
                  className="w-full h-10 px-3 bg-surface-sunken border border-line rounded-xl text-content focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="exp-date" className="block font-semibold text-content-muted mb-1">Date</label>
                <input
                  id="exp-date"
                  type="date"
                  required
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="w-full h-10 px-3 bg-surface-sunken border border-line rounded-xl text-content focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>

              <div>
                <label htmlFor="exp-note" className="block font-semibold text-content-muted mb-1">Note (Optional)</label>
                <input
                  id="exp-note"
                  type="text"
                  placeholder="e.g. South City Clinic"
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  className="w-full h-10 px-3 bg-surface-sunken border border-line rounded-xl text-content focus:outline-none focus:ring-2 focus:ring-accent"
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
        </Dialog>
      </div>
    </AppShell>
  );
}
