import { useState } from 'react';
import { AppShell } from '../../components/layout/AppShell';
import { PageHeader } from '../../components/layout/PageHeader';
import { SectionHeader } from '../../components/ui/SectionHeader';
import { Button } from '../../components/ui/Button';
import { IconButton } from '../../components/ui/IconButton';
import { Card } from '../../components/ui/Card';
import { Field } from '../../components/ui/Field';
import { Input } from '../../components/ui/Input';
import { Textarea } from '../../components/ui/Textarea';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';
import { Dialog } from '../../components/ui/Dialog';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Sheet } from '../../components/ui/Sheet';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/Tabs';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { Toast } from '../../components/ui/Toast';
import { ProgressRing } from '../../components/ui/ProgressRing';
import { Disclaimer } from '../../components/ui/Disclaimer';
import { Stat } from '../../components/ui/Stat';
import { MetricCard } from '../../components/ui/MetricCard';
import { StatusDot } from '../../components/ui/StatusDot';
import { DoseCard } from '../../components/ui/DoseCard';
import { DateStrip } from '../../components/ui/DateStrip';
import { MilestoneBadgeCard } from '../../components/ui/MilestoneBadgeCard';
import { PlusIcon, MedicineIcon, LabFlaskIcon } from '../../components/ui/icons';
import {
  EXTRACTION_DISCLAIMER,
  MEDICINE_INFO_DISCLAIMER,
  REPORT_OUT_OF_RANGE_NOTE,
} from '../../lib/disclaimer';
import { todayInAppTz } from '../../lib/time';
import type { Achievement } from '../../domain/achievements';

const SAMPLE_ACHIEVEMENTS: Achievement[] = [
  {
    id: 'demo-unlocked',
    title: '7-Day Adherence Master',
    description: 'Maintained 100% on-time adherence for 7 consecutive days.',
    icon: 'streak',
    category: 'adherence',
    unlocked: true,
    progress: 100,
    progressLabel: '7 / 7 days',
    badgeLevel: 'bronze',
  },
  {
    id: 'demo-locked',
    title: 'Monthly Adherence Champion',
    description: 'Keep an uninterrupted streak going for a full 30 days.',
    icon: 'trophy',
    category: 'adherence',
    unlocked: false,
    progress: 40,
    progressLabel: '12 / 30 days',
    badgeLevel: 'gold',
  },
];

/**
 * Component catalogue — development only.
 *
 * Lives in its own lazily-loaded route. It previously sat inside `routes.tsx`,
 * which forced every primitive it demonstrates into the initial bundle for all
 * users, and shipped a developer page to production.
 */
export function UiCataloguePage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [toastOpen, setToastOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [selectedDate, setSelectedDate] = useState(todayInAppTz());
  const [segmentedValue, setSegmentedValue] = useState('all');

  return (
    <AppShell>
      <PageHeader
        eyebrow="Development"
        title="Component catalogue"
        description="Every primitive in its default, hover, focus, disabled, error and loading states across the clinical design system."
      />

      <Toast
        open={toastOpen}
        onClose={() => setToastOpen(false)}
        message="Dose marked as taken."
        tone="ok"
      />

      <div className="space-y-12">
        <section className="space-y-4">
          <SectionHeader title="Buttons" />
          <div className="flex flex-wrap items-center gap-3 p-5 rounded-[var(--radius-lg)] border border-line bg-surface-raised">
            <Button variant="primary">Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="subtle">Subtle</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
            <Button loading>Loading</Button>
            <Button disabled>Disabled</Button>
            <Button size="lg" leftIcon={<PlusIcon size={18} />}>
              Large action
            </Button>
            <IconButton aria-label="Add item" variant="secondary">
              <PlusIcon size={18} />
            </IconButton>
            <Button variant="secondary" onClick={() => setToastOpen(true)}>
              Trigger toast
            </Button>
          </div>
        </section>

        <section className="space-y-4">
          <SectionHeader title="Badges & status" />
          <div className="flex flex-wrap items-center gap-3 p-5 rounded-[var(--radius-lg)] border border-line bg-surface-raised">
            <Badge tone="neutral">Neutral</Badge>
            <Badge tone="ok" withIcon>
              Within range
            </Badge>
            <Badge tone="warn" withIcon>
              Check this
            </Badge>
            <Badge tone="risk" withIcon>
              Outside range
            </Badge>
            <Badge tone="info" withIcon>
              Pending order
            </Badge>
            <span className="flex items-center gap-2 text-sm text-content-muted">
              <StatusDot tone="ok" label="Stable" /> Stable
            </span>
            <span className="flex items-center gap-2 text-sm text-content-muted">
              <StatusDot tone="risk" pulse label="Overdue" /> Overdue
            </span>
          </div>
        </section>

        <section className="space-y-4">
          <SectionHeader title="Dose card" meta="Slot-accented" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <DoseCard
              medicineName="Metformin"
              strength="500 mg"
              doseAmount="1 tablet"
              scheduledMinutes={480}
              status="pending"
              withFood
              remaining={18}
            />
            <DoseCard
              medicineName="Atorvastatin"
              strength="20 mg"
              scheduledMinutes={1290}
              status="taken"
              withFood={null}
            />
          </div>
        </section>

        <section className="space-y-4">
          <SectionHeader title="Date strip" />
          <DateStrip value={selectedDate} onChange={setSelectedDate} />
        </section>

        <section className="space-y-4">
          <SectionHeader title="Metrics" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              label="Active medicines"
              value={4}
              detail="Courses running today"
              icon={<MedicineIcon size={17} />}
              to="/medicines/cabinet"
            />
            <MetricCard
              label="Pending labs"
              value={2}
              detail="HbA1c, Lipid profile"
              tone="warn"
              icon={<LabFlaskIcon size={17} />}
            />
            <Stat label="Adherence" value="92%" subtext="Last 30 days" />
            <div className="flex items-center justify-center p-4 rounded-[var(--radius-lg)] border border-line bg-surface-raised">
              <ProgressRing percentage={72} label="adherence" />
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <SectionHeader title="Milestones" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {SAMPLE_ACHIEVEMENTS.map((a) => (
              <MilestoneBadgeCard key={a.id} achievement={a} />
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <SectionHeader title="Form controls" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 p-5 rounded-[var(--radius-lg)] border border-line bg-surface-raised">
            <Field id="ui-input-1" label="Medicine name" hint="As printed on the prescription">
              <Input
                placeholder="e.g. Augmentin 625mg"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
              />
            </Field>

            <Field
              id="ui-input-2"
              label="Duration"
              error="Duration is required to build a schedule"
              required
            >
              <Input placeholder="e.g. 5 days" defaultValue="" />
            </Field>

            <Field id="ui-select-1" label="Frequency">
              <Select
                defaultValue="BD"
                options={[
                  { value: 'OD', label: 'OD — Once daily' },
                  { value: 'BD', label: 'BD — Twice daily' },
                  { value: 'TDS', label: 'TDS — Three times daily' },
                  { value: 'PRN', label: 'PRN — As needed' },
                ]}
              />
            </Field>

            <Field id="ui-textarea-1" label="Doctor’s advice">
              <Textarea placeholder="Dietary restrictions or notes…" />
            </Field>
          </div>
        </section>

        <section className="space-y-4">
          <SectionHeader title="Overlays" />
          <div className="flex flex-wrap gap-3 p-5 rounded-[var(--radius-lg)] border border-line bg-surface-raised">
            <Button variant="secondary" onClick={() => setDialogOpen(true)}>
              Open dialog
            </Button>
            <Button variant="secondary" onClick={() => setConfirmOpen(true)}>
              Open type-to-confirm
            </Button>
            <Button variant="secondary" onClick={() => setSheetOpen(true)}>
              Open sheet
            </Button>
          </div>

          <Dialog
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            title="Quick confirmation"
            description="Escape closes, focus is trapped and restored."
          >
            <p className="text-sm text-content-muted">Dialog body content.</p>
          </Dialog>

          <ConfirmDialog
            open={confirmOpen}
            onOpenChange={setConfirmOpen}
            title="Delete medicine course"
            description="This removes the course and all future scheduled doses."
            requiredPhrase="DELETE"
            tone="danger"
            confirmLabel="Permanently delete"
            onConfirm={() => setConfirmOpen(false)}
          />

          <Sheet
            open={sheetOpen}
            onOpenChange={setSheetOpen}
            title="Medicine information"
            description="Bottom sheet on mobile, drawer on desktop."
          >
            <div className="space-y-4">
              <p className="text-sm text-content-muted">Detailed guidance about this medication.</p>
              <Disclaimer text={MEDICINE_INFO_DISCLAIMER} />
            </div>
          </Sheet>
        </section>

        <section className="space-y-4">
          <SectionHeader title="Tabs & iOS Sliding Segmented Controls" />
          <div className="space-y-4">
            <Card>
              <p className="text-xs font-bold text-content-muted mb-3 uppercase tracking-wider">Radix Tabs (Auto iOS Sliding Track)</p>
              <Tabs defaultValue="today">
                <TabsList>
                  <TabsTrigger value="today">Today</TabsTrigger>
                  <TabsTrigger value="cabinet">Cabinet</TabsTrigger>
                  <TabsTrigger value="history">History</TabsTrigger>
                </TabsList>
                <TabsContent value="today">
                  <p className="text-sm text-content-muted">Today’s timed doses.</p>
                </TabsContent>
                <TabsContent value="cabinet">
                  <p className="text-sm text-content-muted">Current medicines and PRN cabinet.</p>
                </TabsContent>
                <TabsContent value="history">
                  <p className="text-sm text-content-muted">Completed courses.</p>
                </TabsContent>
              </Tabs>
            </Card>

            <Card>
              <p className="text-xs font-bold text-content-muted mb-3 uppercase tracking-wider">iOS Spring Segmented Control</p>
              <SegmentedControl
                value={segmentedValue}
                onChange={(val) => setSegmentedValue(val)}
                options={[
                  { value: 'all', label: 'All History' },
                  { value: 'medicines', label: 'Medicines', icon: <MedicineIcon size={14} /> },
                  { value: 'reports', label: 'Lab Reports', icon: <LabFlaskIcon size={14} /> },
                ]}
              />
            </Card>
          </div>
        </section>

        <section className="space-y-4">
          <SectionHeader title="Loading, empty & error" />
          <div className="space-y-2 p-5 rounded-[var(--radius-lg)] border border-line bg-surface-raised">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <EmptyState
              heading="No prescriptions yet"
              description="Photograph your first paper prescription, or enter the details yourself."
              action={<Button size="sm">Capture prescription</Button>}
            />
            <ErrorState
              title="Could not load lab results"
              message="We couldn’t reach the records server. Retry, or check your offline cache."
              onRetry={() => {}}
            />
          </div>
          <ErrorState compact message="Could not save that dose." onRetry={() => {}} />
        </section>

        <section className="space-y-4">
          <SectionHeader title="Disclaimers" />
          <div className="space-y-2.5">
            <Disclaimer text={EXTRACTION_DISCLAIMER} />
            <Disclaimer text={MEDICINE_INFO_DISCLAIMER} />
            <Disclaimer text={REPORT_OUT_OF_RANGE_NOTE} />
          </div>
        </section>
      </div>
    </AppShell>
  );
}
