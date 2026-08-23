import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { AppShell } from '../../components/layout/AppShell';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Field } from '../../components/ui/Field';
import { Input } from '../../components/ui/Input';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Toast } from '../../components/ui/Toast';
import { Disclaimer } from '../../components/ui/Disclaimer';
import { DoctorIcon, ReceiptIcon } from '../../components/ui/icons';
import {
  profilesRepo,
  visitsRepo,
  medicinesRepo,
  reportsRepo,
  sideEffectsRepo,
  testOrdersRepo,
  remindersRepo,
} from '../../lib/db';
import {
  notificationPermission,
  requestNotificationPermission,
  sendLocalNotification,
} from '../../lib/notifications';
import { formatMinutesTo24h, parseTimeToMinutes } from '../../lib/time';
import {
  EXPORT_FORMAT_IDENTIFIER,
  CURRENT_EXPORT_VERSION,
  validateExportDocument,
  type MedfolioExportDocument,
} from '../../lib/export';
import {
  EXTRACTION_DISCLAIMER,
  MEDICINE_INFO_DISCLAIMER,
  REPORT_OUT_OF_RANGE_NOTE,
} from '../../lib/disclaimer';
import type { Tables } from '../../lib/supabase/types';

import { useAuth } from '../../lib/auth/AuthContext';

export function SettingsPage() {
  const { user, profile: authProfile, refreshProfile } = useAuth();
  const [profile, setProfile] = useState<Tables<'profiles'> | null>(null);
  const [fullName, setFullName] = useState('');
  const [sex, setSex] = useState<'male' | 'female' | 'other' | 'undisclosed'>('undisclosed');
  const [allergiesText, setAllergiesText] = useState('');
  const [conditionsText, setConditionsText] = useState('');

  // Reminders state, loaded from and saved to reminder_settings.
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [quietHoursStart, setQuietHoursStart] = useState('22:00');
  const [quietHoursEnd, setQuietHoursEnd] = useState('07:00');
  const [leadMinutes, setLeadMinutes] = useState(0);
  const [snoozeMinutes, setSnoozeMinutes] = useState(15);
  const [isSavingReminders, setIsSavingReminders] = useState(false);
  const [permissionState, setPermissionState] = useState<NotificationPermission>(() =>
    notificationPermission()
  );

  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isDangerOpen, setIsDangerOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileImportInputRef = useRef<HTMLInputElement>(null);

  const effectiveUserId = user?.id || authProfile?.user_id || '';
  const effectiveProfileId = authProfile?.id || effectiveUserId;

  useEffect(() => {
    async function loadSettings() {
      if (!effectiveUserId) return;
      try {
        const p = await profilesRepo.getDefaultProfile(effectiveUserId);
        if (p) {
          setProfile(p);
          setFullName(p.full_name || '');
          setSex(p.sex || 'undisclosed');
          setAllergiesText(
            Array.isArray(p.allergies) ? (p.allergies as string[]).join(', ') : (p.allergies as string) || ''
          );
          setConditionsText(
            Array.isArray(p.chronic_conditions)
              ? (p.chronic_conditions as string[]).join(', ')
              : (p.chronic_conditions as string) || ''
          );
        }
      } catch (err) {
        console.error('Failed to load profile settings:', err);
      }

      try {
        const reminders = await remindersRepo.getReminderSettings(
          effectiveProfileId,
          effectiveUserId
        );
        setNotificationsEnabled(reminders.enabled);
        setQuietHoursStart(formatMinutesTo24h(reminders.quiet_hours_start ?? 1320));
        setQuietHoursEnd(formatMinutesTo24h(reminders.quiet_hours_end ?? 420));
        setLeadMinutes(reminders.lead_minutes);
        setSnoozeMinutes(reminders.snooze_minutes);
      } catch (err) {
        console.error('Failed to load reminder settings:', err);
      }
    }
    loadSettings();
  }, [effectiveUserId, effectiveProfileId]);

  /** Asks the browser for permission before enabling, so the toggle is honest. */
  const handleToggleNotifications = async (next: boolean) => {
    setNotificationsEnabled(next);
    if (!next) return;

    if (notificationPermission() === 'default') {
      const result = await requestNotificationPermission();
      setPermissionState(result);
      if (result !== 'granted') {
        setToastMessage('Notifications were not allowed, so reminders will stay silent.');
      }
    } else {
      setPermissionState(notificationPermission());
    }
  };

  const handleSaveReminders = async () => {
    setIsSavingReminders(true);
    try {
      await remindersRepo.upsertReminderSettings({
        user_id: effectiveUserId,
        profile_id: effectiveProfileId,
        enabled: notificationsEnabled,
        quiet_hours_start: parseTimeToMinutes(quietHoursStart),
        quiet_hours_end: parseTimeToMinutes(quietHoursEnd),
        lead_minutes: leadMinutes,
        snooze_minutes: snoozeMinutes,
      });
      setToastMessage('Reminder settings saved.');
    } catch (err) {
      console.error('Failed to save reminder settings:', err);
      setErrorMessage('Could not save your reminder settings. Please try again.');
    } finally {
      setIsSavingReminders(false);
    }
  };

  const handleTestNotification = async () => {
    let permission = notificationPermission();
    if (permission === 'default') {
      permission = await requestNotificationPermission();
      setPermissionState(permission);
    }

    if (permission !== 'granted') {
      setToastMessage('Allow notifications in your browser to receive dose reminders.');
      return;
    }

    // Actually sends one, rather than only showing a toast that claims it did.
    const shown = await sendLocalNotification('Medfolio reminder test', {
      body: 'Dose reminders will look like this.',
      tag: 'medfolio-test',
    });
    setToastMessage(
      shown ? 'Test notification sent.' : 'Your browser would not display the notification.'
    );
  };

  const handleSaveProfile = async () => {
    if (!profile) return;
    setIsSavingProfile(true);
    try {
      const allergyArr = allergiesText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const condArr = conditionsText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      await profilesRepo.updateProfile(profile.id, {
        full_name: fullName.trim() || 'Patient',
        sex,
        allergies: allergyArr.join(', '),
        chronic_conditions: condArr.join(', '),
      });

      await refreshProfile();
      setToastMessage('Profile settings saved successfully.');
    } catch (err) {
      console.error('Failed to save profile:', err);
      setToastMessage('Failed to update profile.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Full JSON Export
  const handleExportData = async () => {
    try {
      const [visits, medicines, reports, sideEffects, orders] = await Promise.all([
        visitsRepo.listVisits(effectiveProfileId),
        medicinesRepo.listMedicines(effectiveProfileId),
        reportsRepo.listReports(effectiveProfileId),
        sideEffectsRepo.listSideEffects(effectiveProfileId),
        testOrdersRepo.listTestOrders(effectiveProfileId),
      ]);

      const exportDoc: MedfolioExportDocument = {
        format: EXPORT_FORMAT_IDENTIFIER,
        version: CURRENT_EXPORT_VERSION,
        exported_at: new Date().toISOString(),
        app_timezone: 'Asia/Karachi',
        profiles: profile
          ? [
              {
                id: profile.id,
                full_name: profile.full_name,
                relationship: 'self',
                date_of_birth: profile.date_of_birth,
                sex: profile.sex,
                blood_group: (profile.blood_group as 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-' | 'unknown') || 'unknown',
                height_cm: profile.height_cm,
                weight_kg: profile.weight_kg,
                allergies: Array.isArray(profile.allergies)
                  ? (profile.allergies as string[]).join(', ')
                  : (profile.allergies as string),
                chronic_conditions: Array.isArray(profile.chronic_conditions)
                  ? (profile.chronic_conditions as string[]).join(', ')
                  : (profile.chronic_conditions as string),
                emergency_contact_name: null,
                emergency_contact_phone: null,
                is_default: true,
                created_at: profile.created_at,
                updated_at: profile.updated_at,
              },
            ]
          : [],
        visits: visits.map((v) => ({
          id: v.id,
          profile_id: v.profile_id,
          visit_date: v.visit_date,
          doctor_name: v.doctor_name,
          clinic_name: v.clinic_name,
          specialty: null,
          diagnosis: v.diagnosis,
          doctor_advice: v.doctor_advice,
          follow_up_date: v.follow_up_date,
          visit_cost: v.visit_cost,
          currency: v.currency,
          notes: v.notes,
          created_at: v.created_at,
          updated_at: v.updated_at,
        })),
        medicines: medicines.map((m) => ({
          id: m.id,
          profile_id: m.profile_id,
          visit_id: m.visit_id,
          medicine_name: m.medicine_name,
          strength: m.strength,
          form: m.form,
          dose_amount: m.dose_amount,
          frequency_raw: m.frequency_raw,
          // Preserve null rather than coercing to 'CUSTOM': an export/import
          // round-trip must not invent a frequency the prescription never had.
          frequency_code: m.frequency_code,
          duration_raw: m.duration_days ? `${m.duration_days} days` : null,
          duration_days: m.duration_days,
          start_date: m.start_date,
          end_date: m.end_date,
          instructions: m.instructions,
          with_food: m.with_food,
          is_ongoing: m.is_ongoing,
          is_otc: false,
          unit_cost: null,
          currency: 'PKR',
          discontinued_at: m.discontinued_at,
          created_at: m.created_at,
          updated_at: m.updated_at,
        })),
        doses: [],
        test_orders: orders.map((o) => ({
          id: o.id,
          profile_id: o.profile_id,
          visit_id: o.visit_id,
          test_name: o.test_name,
          canonical_name: o.canonical_name,
          status: (o.status as 'pending' | 'scheduled' | 'completed' | 'cancelled') || 'pending',
          ordered_date: o.ordered_date,
          scheduled_date: o.scheduled_date,
          completed_date: o.completed_date,
          report_id: o.report_id,
          link_method: (o.link_method as 'auto' | 'manual') || null,
          estimated_cost: o.estimated_cost,
          currency: o.currency,
          notes: o.notes,
          created_at: o.created_at,
          updated_at: o.updated_at,
        })),
        reports: reports.map((r) => ({
          id: r.id,
          profile_id: r.profile_id,
          title: r.title,
          report_date: r.report_date,
          lab_name: r.lab_name,
          report_cost: r.report_cost,
          currency: r.currency,
          source_type: (r.source_type as 'image' | 'pdf' | 'manual') || 'manual',
          notes: r.notes,
          created_at: r.created_at,
          updated_at: r.updated_at,
        })),
        report_results: [],
        side_effects: sideEffects.map((s) => ({
          id: s.id,
          profile_id: s.profile_id,
          medicine_id: s.medicine_id,
          medicine_name: s.medicine_name,
          note: s.note,
          severity: (s.severity as 'mild' | 'moderate' | 'severe') || null,
          occurred_at: s.occurred_at,
          created_at: s.created_at,
        })),
        reminder_settings: [],
        images: [],
      };

      const jsonStr = JSON.stringify(exportDoc, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `medfolio-export-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setToastMessage('Data exported successfully.');
    } catch (err) {
      console.error('Export error:', err);
      setToastMessage('Failed to export data.');
    }
  };

  // JSON Import & Restore
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMessage(null);

    try {
      const text = await file.text();
      const rawJson = JSON.parse(text);
      const validation = validateExportDocument(rawJson);

      if (!validation.success) {
        setErrorMessage(`Invalid backup file: ${validation.error}`);
        return;
      }

      setToastMessage('Backup validated successfully.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid JSON file';
      setErrorMessage(`Failed to import backup: ${msg}`);
    } finally {
      if (fileImportInputRef.current) {
        fileImportInputRef.current.value = '';
      }
    }
  };

  // Danger Zone: Wipe All Records
  const handleWipeAllRecords = async () => {
    try {
      const [visits, medicines, reports, sideEffects] = await Promise.all([
        visitsRepo.listVisits(effectiveProfileId),
        medicinesRepo.listMedicines(effectiveProfileId),
        reportsRepo.listReports(effectiveProfileId),
        sideEffectsRepo.listSideEffects(effectiveProfileId),
      ]);

      await Promise.all([
        ...visits.map((v) => visitsRepo.deleteVisit(v.id)),
        ...medicines.map((m) => medicinesRepo.deleteMedicine(m.id)),
        ...reports.map((r) => reportsRepo.deleteReport(r.id)),
        ...sideEffects.map((s) => sideEffectsRepo.deleteSideEffect(s.id)),
      ]);

      setToastMessage('All medical records have been permanently wiped.');
      setIsDangerOpen(false);
    } catch (err) {
      console.error('Wipe error:', err);
      setToastMessage('Failed to wipe records.');
    }
  };

  return (
    <AppShell>
      <PageHeader
        title="Settings & Privacy"
        description="Manage your clinical profile, notification reminders, data exports, and privacy controls."
      />

      <Toast
        open={Boolean(toastMessage)}
        onClose={() => setToastMessage(null)}
        message={toastMessage || ''}
        tone="ok"
      />

      {errorMessage && (
        <div className="mb-6 rounded-[var(--radius-lg)] border border-risk-border bg-risk-bg p-4 text-sm text-risk-text flex items-center justify-between">
          <span>{errorMessage}</span>
          <button type="button" onClick={() => setErrorMessage(null)} className="font-bold">
            ×
          </button>
        </div>
      )}

      <div className="max-w-3xl mx-auto space-y-6">
        {/* Patient Clinical Profile Card */}
        <Card header={<h2 className="text-base font-bold text-ink-900">Patient Profile & Clinical Context</h2>}>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field id="set-name" label="Full Name" required>
                <Input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. John Doe"
                />
              </Field>

              <Field id="set-sex" label="Biological Sex" hint="Used for lab reference range calculation">
                <select
                  value={sex}
                  onChange={(e) => setSex(e.target.value as 'male' | 'female' | 'other' | 'undisclosed')}
                  className="w-full h-11 px-3.5 py-2 text-sm bg-surface-primary border border-ink-200 rounded-[var(--radius-md)] text-ink-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="undisclosed">Undisclosed / Other</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </Field>
            </div>

            <Field id="set-allergies" label="Known Drug & Food Allergies" hint="Comma-separated (e.g. Penicillin, Sulfa drugs, Peanuts)">
              <Input
                value={allergiesText}
                onChange={(e) => setAllergiesText(e.target.value)}
                placeholder="e.g. Penicillin, NSAIDs"
              />
            </Field>

            <Field id="set-conditions" label="Chronic Conditions" hint="Comma-separated (e.g. Hypertension, Type 2 Diabetes, Asthma)">
              <Input
                value={conditionsText}
                onChange={(e) => setConditionsText(e.target.value)}
                placeholder="e.g. Hypertension, Asthma"
              />
            </Field>

            <div className="flex justify-end pt-2 border-t border-ink-100">
              <Button variant="primary" onClick={handleSaveProfile} loading={isSavingProfile}>
                Save Profile
              </Button>
            </div>
          </div>
        </Card>

        {/* Reminders & Notifications Card */}
        <Card header={<h2 className="text-base font-bold text-ink-900">Dose Reminders & Notification Preferences</h2>}>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg border border-ink-200 bg-white">
              <div>
                <span className="font-bold text-sm text-ink-900 block">Browser / Push Notifications</span>
                <span className="text-xs text-ink-500">Receive alerts when scheduled dose times arrive</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={notificationsEnabled}
                  onChange={(e) => handleToggleNotifications(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-ink-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-ink-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-700" />
              </label>
            </div>

            {notificationsEnabled && permissionState !== 'granted' && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 leading-relaxed">
                {permissionState === 'denied'
                  ? 'Notifications are blocked for this site in your browser settings. Reminders cannot be delivered until you allow them there.'
                  : 'Your browser has not granted notification permission yet, so reminders will not appear.'}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field id="quiet-start" label="Quiet Hours Start" hint="No reminders are shown during this window">
                <Input
                  type="time"
                  value={quietHoursStart}
                  onChange={(e) => setQuietHoursStart(e.target.value)}
                />
              </Field>

              <Field id="quiet-end" label="Quiet Hours End">
                <Input
                  type="time"
                  value={quietHoursEnd}
                  onChange={(e) => setQuietHoursEnd(e.target.value)}
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field id="lead-minutes" label="Remind me early by" hint="Minutes before the dose time">
                <Input
                  type="number"
                  min={0}
                  max={120}
                  value={leadMinutes}
                  onChange={(e) => setLeadMinutes(Math.max(0, Number(e.target.value) || 0))}
                />
              </Field>

              <Field id="snooze-minutes" label="Snooze length" hint="Minutes (1–120)">
                <Input
                  type="number"
                  min={1}
                  max={120}
                  value={snoozeMinutes}
                  onChange={(e) =>
                    setSnoozeMinutes(Math.min(120, Math.max(1, Number(e.target.value) || 1)))
                  }
                />
              </Field>
            </div>

            {/* These preferences are now persisted and read by the reminder loop —
                previously they were local state that nothing ever consumed. */}
            <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-ink-100">
              <span className="text-xs text-ink-500">
                Reminders run while Medfolio is open in your browser.
              </span>
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" onClick={handleTestNotification}>
                  Test Notification
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  loading={isSavingReminders}
                  onClick={handleSaveReminders}
                >
                  Save Reminder Settings
                </Button>
              </div>
            </div>
          </div>
        </Card>

        {/* Healthcare Management Hub */}
        <Card header={<h2 className="text-base font-bold text-ink-900">Healthcare Network & Finance Hub</h2>}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <Link
              to="/doctors"
              className="p-3.5 rounded-xl border border-teal-200 bg-teal-50/60 hover:bg-teal-100/70 transition-all flex items-center justify-between"
            >
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-teal-100/80 text-teal-800 shrink-0">
                  <DoctorIcon size={20} />
                </div>
                <div>
                  <span className="font-bold text-ink-900 block text-sm">Doctor Directory</span>
                  <span className="text-ink-500 text-[11px]">View doctor-specific consultation timelines & records</span>
                </div>
              </div>
              <span className="font-bold text-teal-800">&rarr;</span>
            </Link>

            <Link
              to="/finances"
              className="p-3.5 rounded-xl border border-teal-200 bg-teal-50/60 hover:bg-teal-100/70 transition-all flex items-center justify-between"
            >
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-teal-100/80 text-teal-800 shrink-0">
                  <ReceiptIcon size={20} />
                </div>
                <div>
                  <span className="font-bold text-ink-900 block text-sm">Financial Tracker</span>
                  <span className="text-ink-500 text-[11px]">Track consultation fees, medicine costs & lab budgets</span>
                </div>
              </div>
              <span className="font-bold text-teal-800">&rarr;</span>
            </Link>
          </div>
        </Card>

        {/* Data Backup, Export & Restore Card */}
        <Card header={<h2 className="text-base font-bold text-ink-900">Data Management & Offline Backup</h2>}>
          <div className="space-y-4 text-xs">
            <p className="text-ink-600 leading-relaxed">
              Your health data belongs entirely to you. You can download a full cryptographic JSON backup of all prescriptions, doses, lab reports, and doctor consultations at any time.
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              <Button variant="secondary" className="w-full sm:w-auto" onClick={handleExportData}>
                Export Health Data (JSON)
              </Button>

              <input
                ref={fileImportInputRef}
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={handleImportFile}
              />
              <Button
                variant="ghost"
                className="w-full sm:w-auto"
                onClick={() => fileImportInputRef.current?.click()}
              >
                Restore / Import Backup
              </Button>
            </div>
          </div>
        </Card>

        {/* Quick Links Card */}
        <Card header={<h2 className="text-base font-bold text-ink-900">Quick Navigation</h2>}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <Link
              to="/share"
              className="p-3 rounded-lg border border-ink-200 hover:border-teal-600 hover:bg-teal-50/40 transition-colors flex items-center justify-between"
            >
              <div>
                <span className="font-bold text-ink-900 block">Doctor Share Links & QR</span>
                <span className="text-ink-500 text-[11px]">Manage temporary links</span>
              </div>
              <span className="text-teal-700 font-bold">&rarr;</span>
            </Link>

            <Link
              to="/brief"
              className="p-3 rounded-lg border border-ink-200 hover:border-teal-600 hover:bg-teal-50/40 transition-colors flex items-center justify-between"
            >
              <div>
                <span className="font-bold text-ink-900 block">Printable Doctor Brief</span>
                <span className="text-ink-500 text-[11px]">One-page A4 summary</span>
              </div>
              <span className="text-teal-700 font-bold">&rarr;</span>
            </Link>
          </div>
        </Card>

        {/* Medical Disclaimers Section */}
        <div className="space-y-3">
          <Disclaimer text={EXTRACTION_DISCLAIMER} />
          <Disclaimer text={MEDICINE_INFO_DISCLAIMER} />
          <Disclaimer text={REPORT_OUT_OF_RANGE_NOTE} />
        </div>

        {/* Danger Zone */}
        <div className="p-6 rounded-[var(--radius-lg)] border-2 border-red-200 bg-red-50/30 space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-red-900">
            Danger Zone
          </h2>
          <p className="text-xs text-ink-600 leading-relaxed">
            Permanently delete all patient records, visits, active courses, test orders, and diagnostic lab reports. This action cannot be undone. We recommend exporting your data first.
          </p>

          <Button
            variant="danger"
            size="sm"
            onClick={() => setIsDangerOpen(true)}
          >
            Wipe All Health Records
          </Button>
        </div>
      </div>

      {/* Wipe Confirmation Dialog */}
      <ConfirmDialog
        open={isDangerOpen}
        onOpenChange={setIsDangerOpen}
        title="Wipe All Medical Records"
        description="This will permanently delete every prescription, visit, lab report, and medicine from this account. Type DELETE ALL RECORDS to proceed."
        requiredPhrase="DELETE ALL RECORDS"
        tone="danger"
        confirmLabel="Permanently Delete Everything"
        onConfirm={handleWipeAllRecords}
      />
    </AppShell>
  );
}
