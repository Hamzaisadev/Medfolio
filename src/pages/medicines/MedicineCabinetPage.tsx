import { useState, useEffect, useCallback } from 'react';
import { AppShell } from '../../components/layout/AppShell';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/Tabs';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Toast } from '../../components/ui/Toast';
import { EmptyState } from '../../components/ui/EmptyState';
import { useAuth } from '../../lib/auth/AuthContext';
import { medicinesRepo, dosesRepo } from '../../lib/db';
import { todayInAppTz, addDaysAppTz } from '../../lib/time';
import { isActive, recentlyFinishedMedicines } from '../../domain/activeMedicines';
import type { Tables } from '../../lib/supabase/types';

type Medicine = Tables<'medicines'>;

const INVENTORY_STORAGE_KEY = 'medfolio_pill_inventory_v1';

export function MedicineCabinetPage() {
  const { user, profile } = useAuth();
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Pill supply inventory (medicine_id -> remaining pill count)
  const [inventory, setInventory] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem(INVENTORY_STORAGE_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Refill Modal state
  const [refillTarget, setRefillTarget] = useState<Medicine | null>(null);
  const [refillAmount, setRefillAmount] = useState<number>(30);

  // Discontinue confirmation dialog
  const [discontinueTarget, setDiscontinueTarget] = useState<Medicine | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const effectiveUserId = user?.id || profile?.user_id || '';

  const loadMedicines = useCallback(async () => {
    if (!effectiveUserId) return;
    setIsLoading(true);
    try {
      const list = await medicinesRepo.listMedicines(effectiveUserId);
      setMedicines(list);

      // Initialize default pill count if not tracked yet
      setInventory((prev) => {
        const next = { ...prev };
        let modified = false;
        for (const m of list) {
          if (next[m.id] === undefined) {
            const duration = m.duration_days || (m.is_ongoing ? 30 : 10);
            const daily = m.frequency_code === 'BD' ? 2 : m.frequency_code === 'TDS' ? 3 : m.frequency_code === 'QID' ? 4 : 1;
            next[m.id] = duration * daily;
            modified = true;
          }
        }
        if (modified) {
          localStorage.setItem(INVENTORY_STORAGE_KEY, JSON.stringify(next));
        }
        return next;
      });
    } catch {
      setMedicines([]);
    } finally {
      setIsLoading(false);
    }
  }, [effectiveUserId]);

  useEffect(() => {
    loadMedicines();
  }, [loadMedicines]);

  const saveInventory = (newInv: Record<string, number>) => {
    setInventory(newInv);
    try {
      localStorage.setItem(INVENTORY_STORAGE_KEY, JSON.stringify(newInv));
    } catch (err) {
      console.error('Failed to save inventory:', err);
    }
  };

  const handleRefillConfirm = () => {
    if (!refillTarget) return;
    const current = inventory[refillTarget.id] || 0;
    const updated = { ...inventory, [refillTarget.id]: current + refillAmount };
    saveInventory(updated);
    setToastMessage(`Added +${refillAmount} pills to ${refillTarget.medicine_name}.`);
    setRefillTarget(null);
  };

  const todayStr = todayInAppTz();
  const active = medicines.filter((m) => isActive(m, todayStr));
  const past = recentlyFinishedMedicines(medicines, todayStr, 180);

  const prnMedicines = active.filter((m) => m.frequency_code === 'PRN' || m.frequency_code === 'SOS');
  const scheduledActive = active.filter((m) => m.frequency_code !== 'PRN' && m.frequency_code !== 'SOS');

  // Calculate medicines running low (<= 3 days)
  const lowStockMeds = scheduledActive.filter((m) => {
    const count = inventory[m.id] || 0;
    const daily = m.frequency_code === 'BD' ? 2 : m.frequency_code === 'TDS' ? 3 : m.frequency_code === 'QID' ? 4 : 1;
    const daysLeft = Math.floor(count / daily);
    return daysLeft <= 3;
  });

  const handleConfirmDiscontinue = async () => {
    if (!discontinueTarget) return;
    try {
      const nowIso = new Date().toISOString();
      await medicinesRepo.discontinueMedicine(discontinueTarget.id, nowIso);
      await dosesRepo.deleteFuturePendingDoses(discontinueTarget.id, todayStr);
      setToastMessage(`Discontinued ${discontinueTarget.medicine_name}.`);
      setDiscontinueTarget(null);
      await loadMedicines();
    } catch (err: unknown) {
      console.error(err);
    }
  };

  const handleLogPrnDose = async (med: Medicine) => {
    try {
      const effectiveProfileId = profile?.id || effectiveUserId;
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();

      await dosesRepo.createDoses([
        {
          user_id: effectiveUserId,
          profile_id: effectiveProfileId,
          medicine_id: med.id,
          scheduled_date: todayStr,
          scheduled_minutes: currentMinutes,
          status: 'taken',
          taken_at: now.toISOString(),
        },
      ]);

      // Decrement inventory by 1
      const cur = inventory[med.id] || 0;
      if (cur > 0) {
        saveInventory({ ...inventory, [med.id]: cur - 1 });
      }

      setToastMessage(`Logged dose of ${med.medicine_name}.`);
    } catch (err: unknown) {
      console.error(err);
    }
  };

  return (
    <AppShell>
      <PageHeader
        title="Medicine Cabinet & Refill Tracker"
        description="Manage active courses, remaining pill counts, and proactive prescription refill alerts."
      />

      <Toast
        open={Boolean(toastMessage)}
        onClose={() => setToastMessage(null)}
        message={toastMessage || ''}
        tone="ok"
      />

      {/* Proactive Refill Alert Banner */}
      {lowStockMeds.length > 0 && (
        <div className="mb-6 p-4 rounded-2xl bg-amber-50 border border-amber-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📦</span>
            <div>
              <h3 className="font-bold text-sm text-amber-950">
                Refill Alert: {lowStockMeds.length} {lowStockMeds.length === 1 ? 'medication is' : 'medications are'} running out soon
              </h3>
              <p className="text-xs text-amber-800">
                {lowStockMeds.map((m) => m.medicine_name).join(', ')} — running low in ≤ 3 days.
              </p>
            </div>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setRefillTarget(lowStockMeds[0] || null)}
            className="shrink-0 font-bold"
          >
            + Log Refill Pack
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="py-12 text-center text-sm text-ink-500">Loading medicines...</div>
      ) : (
        <Tabs defaultValue="active">
          <TabsList className="mb-6">
            <TabsTrigger value="active">Active Courses ({scheduledActive.length})</TabsTrigger>
            <TabsTrigger value="prn">As-Needed / PRN ({prnMedicines.length})</TabsTrigger>
            <TabsTrigger value="past">Past Courses ({past.length})</TabsTrigger>
          </TabsList>

          {/* Active Scheduled Courses */}
          <TabsContent value="active">
            {scheduledActive.length === 0 ? (
              <EmptyState
                heading="No active courses"
                description="You have no ongoing or scheduled medicine courses right now."
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {scheduledActive.map((med) => {
                  const count = inventory[med.id] ?? 20;
                  const daily = med.frequency_code === 'BD' ? 2 : med.frequency_code === 'TDS' ? 3 : med.frequency_code === 'QID' ? 4 : 1;
                  const daysLeft = Math.floor(count / daily);
                  const exhaustionDate = addDaysAppTz(todayStr, daysLeft);
                  const isLow = daysLeft <= 3;
                  const isCaution = daysLeft <= 7 && !isLow;

                  return (
                    <Card key={med.id}>
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-base font-bold text-ink-900">{med.medicine_name}</h3>
                            {med.strength && (
                              <span className="text-xs text-ink-600 font-medium">
                                ({med.strength})
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-ink-500 mt-0.5">
                            {med.frequency_raw || med.frequency_code} • {med.duration_raw || (med.is_ongoing ? 'Ongoing' : 'Finite course')}
                          </p>
                          {med.instructions && (
                            <p className="text-xs text-ink-700 mt-2 bg-ink-50 p-2 rounded">
                              {med.instructions}
                            </p>
                          )}
                        </div>
                        <Badge tone={isLow ? 'risk' : isCaution ? 'warn' : 'ok'} size="sm">
                          {isLow ? '🔴 Low Stock' : isCaution ? '🟡 1 Week Left' : '🟢 Stocked'}
                        </Badge>
                      </div>

                      {/* Visual Pill Inventory Bar */}
                      <div className="mt-3 p-3 bg-ink-50 rounded-xl border border-ink-100 space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-ink-700">📦 Remaining Supply:</span>
                          <span className="font-bold text-ink-900">{count} tablets ({daysLeft} days)</span>
                        </div>

                        {/* Progress meter */}
                        <div className="w-full bg-ink-200 h-2 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              isLow ? 'bg-red-500' : isCaution ? 'bg-amber-500' : 'bg-teal-600'
                            }`}
                            style={{ width: `${Math.min(100, Math.max(8, (daysLeft / 30) * 100))}%` }}
                          />
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-ink-500 pt-0.5">
                          <span>Burn: {daily} tab/day</span>
                          <span>Est. Depletion: <strong>{exhaustionDate}</strong></span>
                        </div>
                      </div>

                      <div className="mt-3 pt-3 border-t border-ink-200 flex items-center justify-between">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setRefillTarget(med)}
                          className="text-xs font-bold"
                        >
                          + Refill Pack
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-800 text-xs"
                          onClick={() => setDiscontinueTarget(med)}
                        >
                          Discontinue
                        </Button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* PRN / As Needed */}
          <TabsContent value="prn">
            {prnMedicines.length === 0 ? (
              <EmptyState
                heading="No PRN medicines"
                description="As-needed medicines (e.g. Panadol for fever, Inhalers) will appear here."
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {prnMedicines.map((med) => {
                  const count = inventory[med.id] ?? 20;

                  return (
                    <Card key={med.id}>
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="text-base font-bold text-ink-900">{med.medicine_name}</h3>
                          <p className="text-xs text-ink-500 mt-0.5">
                            {med.frequency_raw || 'Take as needed'}
                          </p>
                          {med.instructions && (
                            <p className="text-xs text-ink-700 mt-2 bg-ink-50 p-2 rounded">
                              {med.instructions}
                            </p>
                          )}
                        </div>
                        <Badge tone="info" size="sm">As Needed</Badge>
                      </div>

                      <div className="mt-3 p-2.5 bg-ink-50 rounded-xl border border-ink-100 flex items-center justify-between text-xs">
                        <span className="text-ink-600">Cabinet Pack:</span>
                        <span className="font-bold text-ink-900">{count} pills left</span>
                      </div>

                      <div className="mt-4 pt-3 border-t border-ink-200 flex items-center justify-between">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setRefillTarget(med)}
                          className="text-xs"
                        >
                          + Refill
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleLogPrnDose(med)}
                          className="font-bold text-xs"
                        >
                          Log Dose Taken (-1)
                        </Button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* Past Courses */}
          <TabsContent value="past">
            {past.length === 0 ? (
              <EmptyState
                heading="No completed courses"
                description="Finished or discontinued courses will be listed here."
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {past.map((med) => (
                  <Card key={med.id} className="opacity-80">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-base font-bold text-ink-900">{med.medicine_name}</h3>
                        <p className="text-xs text-ink-500 mt-0.5">
                          {med.start_date} to {med.end_date || med.discontinued_at || 'Ended'}
                        </p>
                      </div>
                      <Badge tone="neutral" size="sm">
                        {med.discontinued_at ? 'Discontinued' : 'Completed'}
                      </Badge>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}

      {/* Refill Pack Modal */}
      {refillTarget && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-xl animate-in fade-in zoom-in-95">
            <h3 className="text-base font-bold text-ink-900">
              Log Refill Pack for {refillTarget.medicine_name}
            </h3>
            <p className="text-xs text-ink-600">
              Current inventory: <strong>{inventory[refillTarget.id] || 0} tablets</strong>. Select the pack size purchased:
            </p>

            <div className="grid grid-cols-3 gap-2">
              {[10, 20, 30].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setRefillAmount(amt)}
                  className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                    refillAmount === amt
                      ? 'bg-teal-700 text-white border-teal-800 shadow-2xs'
                      : 'bg-ink-50 border-ink-200 text-ink-800 hover:bg-ink-100'
                  }`}
                >
                  +{amt} Pills
                </button>
              ))}
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setRefillTarget(null)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={handleRefillConfirm} className="font-bold">
                Confirm Refill (+{refillAmount})
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Discontinue Confirm Dialog */}
      <ConfirmDialog
        open={Boolean(discontinueTarget)}
        onOpenChange={(open) => !open && setDiscontinueTarget(null)}
        title="Discontinue Medicine"
        description={`Are you sure you want to stop taking "${discontinueTarget?.medicine_name}"? All future scheduled doses will be removed, while past dose history will be preserved.`}
        confirmLabel="Discontinue Course"
        tone="danger"
        onConfirm={handleConfirmDiscontinue}
      />
    </AppShell>
  );
}
