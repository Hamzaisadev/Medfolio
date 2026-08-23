import { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { AppShell } from '../../components/layout/AppShell';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/Tabs';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Dialog } from '../../components/ui/Dialog';
import { Toast } from '../../components/ui/Toast';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { Skeleton } from '../../components/ui/Skeleton';
import { SectionHeader } from '../../components/ui/SectionHeader';
import { PackageIcon, PlusIcon, CheckIcon, MedicineIcon } from '../../components/ui/icons';
import { useAuth } from '../../lib/auth/AuthContext';
import { medicinesRepo, dosesRepo } from '../../lib/db';
import { readInventory, writeInventory } from '../../lib/inventory';
import { todayInAppTz, addDaysAppTz, formatDateShort, formatDateMedium } from '../../lib/time';
import { isActive, recentlyFinishedMedicines } from '../../domain/activeMedicines';
import { mealRelationLabel } from '../../domain/mealRelation';
import type { Tables } from '../../lib/supabase/types';

type Medicine = Tables<'medicines'>;

const REFILL_PACK_SIZES = [10, 20, 30, 60];

/** Tablets consumed per day, from the frequency code. */
function dailyBurn(code: string | null | undefined): number {
  switch (code) {
    case 'BD':
      return 2;
    case 'TDS':
      return 3;
    case 'QID':
      return 4;
    default:
      return 1;
  }
}

/** A course is flagged for refill at three days of supply or less. */
const LOW_STOCK_DAYS = 3;
const CAUTION_STOCK_DAYS = 7;

export function MedicineCabinetPage() {
  const { user, profile } = useAuth();
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Pill supply inventory (medicine_id -> remaining count), scoped per profile.
  const [inventory, setInventory] = useState<Record<string, number>>({});

  const [refillTarget, setRefillTarget] = useState<Medicine | null>(null);
  const [refillAmount, setRefillAmount] = useState<number>(30);
  const [discontinueTarget, setDiscontinueTarget] = useState<Medicine | null>(null);
  const [toast, setToast] = useState<{ message: string; tone: 'ok' | 'risk' } | null>(null);

  const location = useLocation();
  const navigate = useNavigate();

  // Confirmation handed over by the prescription review page. Shown here because
  // a toast set immediately before navigating never renders.
  useEffect(() => {
    const flash = (location.state as { flash?: string } | null)?.flash;
    if (flash) {
      setToast({ message: flash, tone: 'ok' });
      // Clear it so a refresh or back-navigation does not replay the message.
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.pathname, location.state, navigate]);

  const effectiveUserId = user?.id || profile?.user_id || '';
  const effectiveProfileId = profile?.id || effectiveUserId;

  const loadMedicines = useCallback(async () => {
    if (!effectiveProfileId) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const list = await medicinesRepo.listMedicines(effectiveProfileId);
      setMedicines(list);

      // Seed a starting count for anything not tracked yet, using this profile's
      // own inventory rather than a single shared key.
      const stored = readInventory(effectiveProfileId);
      let modified = false;
      for (const m of list) {
        if (stored[m.id] === undefined) {
          const duration = m.duration_days || (m.is_ongoing ? 30 : 10);
          stored[m.id] = duration * dailyBurn(m.frequency_code);
          modified = true;
        }
      }
      if (modified) writeInventory(effectiveProfileId, stored);
      setInventory(stored);
    } catch (err) {
      console.error('Failed to load medicines:', err);
      // A toast disappears after a few seconds; a failed load must remain a
      // visible, retryable state instead of posing as an empty cabinet.
      setLoadError('Your medicine cabinet could not be loaded. Check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  }, [effectiveProfileId]);

  useEffect(() => {
    loadMedicines();
  }, [loadMedicines]);

  const saveInventory = (next: Record<string, number>) => {
    setInventory(next);
    writeInventory(effectiveProfileId, next);
  };

  const handleRefillConfirm = () => {
    if (!refillTarget) return;
    const current = countFor(refillTarget);
    saveInventory({ ...inventory, [refillTarget.id]: current + refillAmount });
    setToast({
      message: `Added ${refillAmount} tablets of ${refillTarget.medicine_name}.`,
      tone: 'ok',
    });
    setRefillTarget(null);
  };

  const handleConfirmDiscontinue = async () => {
    if (!discontinueTarget) return;
    const name = discontinueTarget.medicine_name;
    try {
      await medicinesRepo.discontinueMedicine(discontinueTarget.id, new Date().toISOString());
      await dosesRepo.deleteFuturePendingDoses(discontinueTarget.id, todayStr);
      setDiscontinueTarget(null);
      setToast({ message: `Stopped ${name}. Future doses removed.`, tone: 'ok' });
      await loadMedicines();
    } catch (err: unknown) {
      console.error(err);
      // Previously this only reached the console, so a failed write looked
      // exactly like a successful one.
      setToast({
        message: err instanceof Error ? err.message : `Could not stop ${name}. Please try again.`,
        tone: 'risk',
      });
    }
  };

  const handleLogPrnDose = async (med: Medicine) => {
    try {
      const now = new Date();
      await dosesRepo.createDoses([
        {
          user_id: effectiveUserId,
          profile_id: effectiveProfileId,
          medicine_id: med.id,
          scheduled_date: todayStr,
          scheduled_minutes: now.getHours() * 60 + now.getMinutes(),
          status: 'taken',
          taken_at: now.toISOString(),
        },
      ]);

      const current = countFor(med);
      if (current > 0) saveInventory({ ...inventory, [med.id]: current - 1 });

      setToast({ message: `Logged a dose of ${med.medicine_name}.`, tone: 'ok' });
    } catch (err: unknown) {
      console.error(err);
      setToast({
        message: err instanceof Error ? err.message : 'Could not log that dose. Please try again.',
        tone: 'risk',
      });
    }
  };

  const todayStr = todayInAppTz();

  /**
   * Remaining tablets for a medicine.
   *
   * One accessor, so the card and the refill banner cannot disagree: they used
   * `?? 20` and `|| 0` respectively, which let a card read "20 tablets · Stocked"
   * directly under a banner saying the same medicine was running out.
   */
  const countFor = (med: Medicine): number => inventory[med.id] ?? 0;

  const daysLeftFor = (med: Medicine): number =>
    Math.floor(countFor(med) / dailyBurn(med.frequency_code));

  const active = medicines.filter((m) => isActive(m, todayStr));
  const past = recentlyFinishedMedicines(medicines, todayStr, 180);
  const prnMedicines = active.filter(
    (m) => m.frequency_code === 'PRN' || m.frequency_code === 'SOS'
  );
  const scheduledActive = active.filter(
    (m) => m.frequency_code !== 'PRN' && m.frequency_code !== 'SOS'
  );
  const lowStockMeds = scheduledActive.filter((m) => daysLeftFor(m) <= LOW_STOCK_DAYS);

  return (
    <AppShell>
      <PageHeader
        title="Medicine cabinet"
        description="What you are taking, how much is left, and when to buy more."
        action={
          <Link to="/prescriptions/new" className="hidden sm:block">
            <Button leftIcon={<PlusIcon size={17} />}>Add prescription</Button>
          </Link>
        }
      />

      {toast && (
        <Toast open onClose={() => setToast(null)} message={toast.message} tone={toast.tone} />
      )}

      {!loadError && lowStockMeds.length > 0 && (
        <Card accent="warn" className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <span className="shrink-0 flex items-center justify-center w-11 h-11 rounded-[var(--radius-md)] bg-warn-bg text-warn-text">
              <PackageIcon size={21} />
            </span>
            <div className="flex-1 min-w-0">
              <h2 className="text-sm font-bold text-content">
                {lowStockMeds.length === 1
                  ? '1 medicine is running out'
                  : `${lowStockMeds.length} medicines are running out`}
              </h2>
              <p className="mt-1 text-xs text-content-muted">
                {lowStockMeds.map((m) => m.medicine_name).join(', ')} —{' '}
                {LOW_STOCK_DAYS} days of supply or less.
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => setRefillTarget(lowStockMeds[0] ?? null)}
              className="shrink-0"
            >
              Log a refill
            </Button>
          </div>
        </Card>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-52 w-full rounded-[var(--radius-lg)]" />
          ))}
        </div>
      ) : loadError ? (
        <ErrorState
          title="Cabinet didn't load"
          message={loadError}
          onRetry={loadMedicines}
        />
      ) : (
        <Tabs defaultValue="active">
          <TabsList className="mb-2">
            <TabsTrigger value="active">Taking now ({scheduledActive.length})</TabsTrigger>
            <TabsTrigger value="prn">As needed ({prnMedicines.length})</TabsTrigger>
            <TabsTrigger value="past">Finished ({past.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="active">
            {scheduledActive.length === 0 ? (
              <EmptyState
                heading="No courses running"
                description="Medicines with a set dose schedule will appear here."
                action={
                  <Link to="/prescriptions/new">
                    <Button leftIcon={<PlusIcon size={17} />}>Add a prescription</Button>
                  </Link>
                }
              />
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {scheduledActive.map((med) => {
                  const count = countFor(med);
                  const burn = dailyBurn(med.frequency_code);
                  const daysLeft = daysLeftFor(med);
                  const isLow = daysLeft <= LOW_STOCK_DAYS;
                  const isCaution = !isLow && daysLeft <= CAUTION_STOCK_DAYS;

                  return (
                    <Card key={med.id} accent={isLow ? 'risk' : isCaution ? 'warn' : 'ok'}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="text-base font-bold text-content">
                            {med.medicine_name}
                            {med.strength && (
                              <span className="ml-1.5 text-sm font-medium text-content-muted">
                                {med.strength}
                              </span>
                            )}
                          </h3>
                          <p className="mt-1 text-sm text-content-muted">
                            {med.frequency_raw || med.frequency_code} ·{' '}
                            {med.duration_raw || (med.is_ongoing ? 'Ongoing' : 'Fixed course')}
                          </p>
                          <p className="mt-0.5 text-xs text-content-subtle">
                            {mealRelationLabel(med.with_food)}
                          </p>
                        </div>

                        <Badge tone={isLow ? 'risk' : isCaution ? 'warn' : 'ok'} size="sm" withIcon>
                          {isLow ? 'Buy more' : isCaution ? 'A week left' : 'Stocked'}
                        </Badge>
                      </div>

                      {med.instructions && (
                        <p className="mt-3 text-sm text-content-muted bg-surface-sunken border border-line rounded-[var(--radius-md)] px-3 py-2.5">
                          {med.instructions}
                        </p>
                      )}

                      <div className="mt-4 p-3.5 rounded-[var(--radius-md)] bg-surface-sunken border border-line space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-semibold text-content-muted">Supply left</span>
                          <span className="font-bold text-content" data-numeric>
                            {count} {count === 1 ? 'tablet' : 'tablets'}
                            {count > 0 && ` · ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'}`}
                          </span>
                        </div>

                        <div
                          className="w-full bg-line h-2 rounded-full overflow-hidden"
                          role="progressbar"
                          aria-valuenow={Math.min(30, daysLeft)}
                          aria-valuemin={0}
                          aria-valuemax={30}
                          aria-label={`${daysLeft} days of supply remaining`}
                        >
                          <div
                            className={`h-full rounded-full transition-[width] duration-[var(--duration-slow)] ${
                              isLow ? 'bg-risk-text' : isCaution ? 'bg-warn-text' : 'bg-accent'
                            }`}
                            style={{ width: `${Math.min(100, (daysLeft / 30) * 100)}%` }}
                          />
                        </div>

                        <div className="flex items-center justify-between text-xs text-content-subtle">
                          <span data-numeric>
                            {burn} {burn === 1 ? 'tablet' : 'tablets'} a day
                          </span>
                          {count > 0 && (
                            <span>Runs out {formatDateShort(addDaysAppTz(todayStr, daysLeft))}</span>
                          )}
                        </div>
                      </div>

                      <div className="mt-4 pt-4 border-t border-line flex items-center justify-between gap-2">
                        <Button variant="secondary" size="sm" onClick={() => setRefillTarget(med)}>
                          Log a refill
                        </Button>
                        <div className="flex items-center gap-1">
                          <Link to={`/medicines/${med.id}`}>
                            <Button variant="ghost" size="sm">
                              Details
                            </Button>
                          </Link>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-risk-text hover:bg-risk-bg"
                            onClick={() => setDiscontinueTarget(med)}
                          >
                            Stop
                          </Button>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="prn">
            {prnMedicines.length === 0 ? (
              <EmptyState
                heading="Nothing taken as needed"
                description="Medicines you take only when required — painkillers, inhalers — appear here."
              />
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {prnMedicines.map((med) => (
                  <Card key={med.id} accent="info">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="text-base font-bold text-content">
                          {med.medicine_name}
                          {med.strength && (
                            <span className="ml-1.5 text-sm font-medium text-content-muted">
                              {med.strength}
                            </span>
                          )}
                        </h3>
                        <p className="mt-1 text-sm text-content-muted">
                          {med.frequency_raw || 'Take only when needed'}
                        </p>
                      </div>
                      <Badge tone="info" size="sm">
                        As needed
                      </Badge>
                    </div>

                    {med.instructions && (
                      <p className="mt-3 text-sm text-content-muted bg-surface-sunken border border-line rounded-[var(--radius-md)] px-3 py-2.5">
                        {med.instructions}
                      </p>
                    )}

                    <div className="mt-4 flex items-center justify-between text-sm p-3 rounded-[var(--radius-md)] bg-surface-sunken border border-line">
                      <span className="text-content-muted">In your cabinet</span>
                      <span className="font-bold text-content" data-numeric>
                        {countFor(med)} left
                      </span>
                    </div>

                    <div className="mt-4 pt-4 border-t border-line flex items-center justify-between gap-2">
                      <Button variant="secondary" size="sm" onClick={() => setRefillTarget(med)}>
                        Log a refill
                      </Button>
                      <Button
                        size="sm"
                        leftIcon={<CheckIcon size={16} />}
                        onClick={() => handleLogPrnDose(med)}
                      >
                        I took one
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="past">
            {past.length === 0 ? (
              <EmptyState
                heading="Nothing finished yet"
                description="Courses you complete or stop will be kept here for your record."
              />
            ) : (
              <>
                <SectionHeader title="Last 6 months" className="mb-4" />
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {past.map((med) => (
                    <Card key={med.id}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="text-sm font-bold text-content-muted">
                            {med.medicine_name}
                            {med.strength ? ` ${med.strength}` : ''}
                          </h3>
                          <p className="mt-1 text-xs text-content-subtle">
                            {formatDateMedium(med.start_date)} to{' '}
                            {med.end_date
                              ? formatDateMedium(med.end_date)
                              : med.discontinued_at
                                ? formatDateMedium(med.discontinued_at.slice(0, 10))
                                : 'ended'}
                          </p>
                        </div>
                        <Badge tone="neutral" size="sm">
                          {med.discontinued_at ? 'Stopped early' : 'Completed'}
                        </Badge>
                      </div>
                    </Card>
                  ))}
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>
      )}

      {/* Refill dialog. Uses the shared Dialog rather than a hand-rolled overlay:
          the previous one had no focus trap, no Escape handler, no scroll lock and
          no aria-modal. */}
      <Dialog
        open={Boolean(refillTarget)}
        onOpenChange={(open) => !open && setRefillTarget(null)}
        title={refillTarget ? `Refill ${refillTarget.medicine_name}` : 'Refill'}
        description={
          refillTarget
            ? `You have ${countFor(refillTarget)} tablets recorded. How many did you buy?`
            : undefined
        }
      >
        <div className="space-y-5">
          <div
            className="grid grid-cols-2 sm:grid-cols-4 gap-2"
            role="radiogroup"
            aria-label="Pack size"
          >
            {REFILL_PACK_SIZES.map((amount) => (
              <button
                key={amount}
                type="button"
                role="radio"
                aria-checked={refillAmount === amount}
                onClick={() => setRefillAmount(amount)}
                className={`h-12 rounded-[var(--radius-md)] text-sm font-bold border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                  refillAmount === amount
                    ? 'bg-accent text-content-onaccent border-accent'
                    : 'bg-surface-raised border-line text-content hover:bg-surface-hover'
                }`}
              >
                +{amount}
              </button>
            ))}
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5 pt-4 border-t border-line">
            <Button variant="ghost" onClick={() => setRefillTarget(null)}>
              Cancel
            </Button>
            <Button onClick={handleRefillConfirm} leftIcon={<PackageIcon size={17} />}>
              Add {refillAmount} tablets
            </Button>
          </div>
        </div>
      </Dialog>

      <ConfirmDialog
        open={Boolean(discontinueTarget)}
        onOpenChange={(open) => !open && setDiscontinueTarget(null)}
        title="Stop taking this medicine?"
        description={`This removes all future scheduled doses for "${discontinueTarget?.medicine_name}". Doses you have already recorded are kept. Only stop a medicine when your doctor has told you to.`}
        confirmLabel="Stop this course"
        tone="danger"
        onConfirm={handleConfirmDiscontinue}
      />

      <div className="sm:hidden mt-8">
        <Link to="/prescriptions/new">
          <Button fullWidth size="lg" leftIcon={<MedicineIcon size={18} />}>
            Add a prescription
          </Button>
        </Link>
      </div>
    </AppShell>
  );
}
