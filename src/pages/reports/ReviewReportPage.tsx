import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AppShell } from '../../components/layout/AppShell';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Field } from '../../components/ui/Field';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';
import { Disclaimer } from '../../components/ui/Disclaimer';
import { Toast } from '../../components/ui/Toast';
import { evaluateLabResult, type ProfileSex } from '../../domain/referenceRange';
import { useAuth } from '../../lib/auth/AuthContext';
import { todayInAppTz } from '../../lib/time';
import { REPORT_OUT_OF_RANGE_NOTE } from '../../lib/disclaimer';
import { reportsRepo, testOrdersRepo, extractionAuditRepo } from '../../lib/db';
import type { Json, Tables } from '../../lib/supabase/types';
import type { ExtractLabReportResponse } from '../../../api/_lib/schemas';
import type { ProcessedImage } from '../../lib/files/imagePipeline';

type TestOrder = Tables<'test_orders'>;

interface ResultItemDraft {
  id: string;
  test_name: string;
  value_text: string;
  unit?: string;
  reference_range?: string;
  range_status?: string;
  flag?: string | null;
  confidence?: 'high' | 'low';
}

export function ReviewReportPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const state = location.state as {
    draft?: ExtractLabReportResponse;
    rawResponse?: unknown;
    model?: string;
    images?: ProcessedImage[];
    linkedOrderId?: string;
    manual?: boolean;
  } | null;

  const initialDraft = state?.draft;
  const images = state?.images || [];

  const effectiveUserId = user?.id || profile?.user_id || '';
  const effectiveProfileId = profile?.id || effectiveUserId;
  // Needed for sex-specific reference ranges ("M: 13-17, F: 12-15"); without it
  // every such range evaluates as "Not evaluated".
  const profileSex = (profile?.sex ?? null) as ProfileSex;

  // Form State
  const [reportTitle, setReportTitle] = useState(initialDraft?.title || 'Lab Test Report');
  const [labName, setLabName] = useState(initialDraft?.lab_name || '');
  const [reportDate, setReportDate] = useState(
    initialDraft?.report_date || todayInAppTz()
  );
  const [selectedOrderId, setSelectedOrderId] = useState<string>(state?.linkedOrderId || '');
  const [pendingOrders, setPendingOrders] = useState<TestOrder[]>([]);

  // Image Viewer & Hover Zoom State
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isHoverZooming, setIsHoverZooming] = useState(false);
  const [zoomLevel, setZoomLevel] = useState<number>(2.5);
  const [zoomOrigin, setZoomOrigin] = useState<{ x: number; y: number }>({ x: 50, y: 50 });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const imageContainerRef = useRef<HTMLDivElement>(null);

  const handleImageMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!imageContainerRef.current) return;
    const rect = imageContainerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setZoomOrigin({
      x: Math.max(0, Math.min(100, x)),
      y: Math.max(0, Math.min(100, y)),
    });
  };

  // Results Rows
  const [results, setResults] = useState<ResultItemDraft[]>(
    (initialDraft?.results || []).map((r, idx) => {
      const evalStatus = evaluateLabResult(r.value_text, r.reference_range || undefined, profileSex);
      return {
        id: `res-${idx}-${Date.now()}`,
        test_name: r.test_name || '',
        value_text: r.value_text || '',
        unit: r.unit || '',
        reference_range: r.reference_range || '',
        range_status: evalStatus.rangeStatus,
        flag: evalStatus.rangeStatus === 'within' ? null : evalStatus.rangeStatus,
        confidence: r.confidence || 'high',
      };
    })
  );

  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Load pending orders to link
  useEffect(() => {
    async function loadPending() {
      if (!effectiveProfileId) return;
      try {
        const list = await testOrdersRepo.listPendingTestOrders(effectiveProfileId);
        setPendingOrders(list);
      } catch (err) {
        console.error('Failed to load pending orders:', err);
      }
    }
    loadPending();
  }, [effectiveProfileId]);

  const handleAddResult = () => {
    setResults((prev) => [
      ...prev,
      {
        id: `res-${Date.now()}`,
        test_name: '',
        value_text: '',
        unit: '',
        reference_range: '',
        confidence: 'high',
      },
    ]);
  };

  const handleUpdateResult = (id: string, updates: Partial<ResultItemDraft>) => {
    setResults((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...updates } : r))
    );
  };

  const handleRemoveResult = (id: string) => {
    setResults((prev) => prev.filter((r) => r.id !== id));
  };

  // Save Transaction
  const handleSave = async () => {
    setErrorMessage(null);

    if (!reportTitle.trim()) {
      setErrorMessage('Please enter a report title.');
      return;
    }

    if (results.length === 0) {
      setErrorMessage('Please add at least one test result row.');
      return;
    }

    for (let i = 0; i < results.length; i++) {
      const res = results[i];
      if (!res || !res.test_name.trim()) {
        setErrorMessage(`Result #${i + 1} must have a test name.`);
        return;
      }
      if (!res.value_text.trim()) {
        setErrorMessage(`Result #${i + 1} (${res.test_name}) must have a result value.`);
        return;
      }
    }

    setIsSaving(true);

    try {
      const effectiveDate = reportDate || todayInAppTz();

      // Step 1: Create Report Record
      const createdReport = await reportsRepo.createReport({
        user_id: effectiveUserId,
        profile_id: effectiveProfileId,
        title: reportTitle,
        lab_name: labName || null,
        report_date: effectiveDate,
      });

      // Step 2: Insert Report Results with Evaluated Reference Ranges
      const resultInserts = results.map((r) => {
        const evaluation = evaluateLabResult(r.value_text, r.reference_range, profileSex);
        const numVal = parseFloat(r.value_text);

        return {
          user_id: effectiveUserId,
          report_id: createdReport.id,
          test_name: r.test_name,
          value_text: r.value_text,
          value_numeric: isNaN(numVal) ? null : numVal,
          unit: r.unit || null,
          reference_range: r.reference_range || null,
          ref_low: evaluation.low,
          ref_high: evaluation.high,
          range_status: evaluation.rangeStatus,
        };
      });

      await reportsRepo.addReportResults(resultInserts);

      // Step 3: If linked to a pending order, link and mark test order completed
      if (selectedOrderId) {
        await testOrdersRepo.linkTestOrderToReport(
          selectedOrderId,
          createdReport.id,
          'manual',
          effectiveDate
        );
      }

      // Step 4: Extraction Audit Logging
      if (state?.rawResponse) {
        await extractionAuditRepo.logExtractionAudit({
          user_id: effectiveUserId,
          entity_type: 'report',
          entity_id: createdReport.id,
          model: state.model || 'lab-reader',
          raw_response: state.rawResponse as Json,
          confirmed_data: {
            title: reportTitle,
            lab_name: labName,
            report_date: effectiveDate,
            results_count: results.length,
          } as Json,
          edited_fields: [],
        });
      }

      setToastMessage('Lab report saved successfully.');
      setTimeout(() => {
        navigate('/reports');
      }, 1000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save lab report';
      setErrorMessage(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const activeImg = images[activeImageIndex];

  return (
    <AppShell>
      <PageHeader
        title="Review Lab Report"
        description="Verify extracted lab tests, units, and reference ranges before saving."
        action={
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => navigate(-1)} disabled={isSaving}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSave} loading={isSaving}>
              Save Report & Results
            </Button>
          </div>
        }
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

      {/* Main 2-Column Split: Original Lab Photo + Form Fields */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (5/12): Sticky Lab Photo Viewer & Metadata */}
        <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-20">
          {/* Lab Photo Card with Hover Magnifier */}
          {activeImg && (
            <Card
              header={
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-ink-900">Original Lab Report</h2>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 font-semibold border border-teal-200">
                      Page {activeImageIndex + 1}/{images.length}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center bg-ink-100 p-0.5 rounded-md text-xs font-semibold text-ink-600">
                      {[2, 2.5, 3.5].map((level) => (
                        <button
                          key={level}
                          type="button"
                          onClick={() => setZoomLevel(level)}
                          className={`px-1.5 py-0.5 rounded transition-colors ${
                            zoomLevel === level ? 'bg-white text-teal-800 shadow-xs' : 'hover:text-ink-900'
                          }`}
                        >
                          {level}x
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(true)}
                      className="text-xs text-teal-700 hover:text-teal-900 font-medium underline ml-1"
                    >
                      Fullscreen
                    </button>
                  </div>
                </div>
              }
            >
              <div className="space-y-3">
                {/* Active Image Box with Dynamic Hover Zoom */}
                <div
                  ref={imageContainerRef}
                  onMouseEnter={() => setIsHoverZooming(true)}
                  onMouseLeave={() => setIsHoverZooming(false)}
                  onMouseMove={handleImageMouseMove}
                  className="relative w-full h-[420px] rounded-[var(--radius-md)] border border-ink-200 bg-ink-900/5 overflow-hidden flex items-center justify-center cursor-crosshair select-none group"
                >
                  <img
                    src={`data:${activeImg.mimeType};base64,${activeImg.dataBase64}`}
                    alt={`Lab report page ${activeImageIndex + 1}`}
                    className="w-full h-full object-contain pointer-events-none transition-transform duration-75 ease-out"
                    style={{
                      transformOrigin: `${zoomOrigin.x}% ${zoomOrigin.y}%`,
                      transform: isHoverZooming ? `scale(${zoomLevel})` : 'scale(1)',
                    }}
                  />

                  {!isHoverZooming && (
                    <div className="absolute bottom-2 right-2 bg-ink-900/75 backdrop-blur-xs text-white text-[11px] font-medium px-2.5 py-1 rounded-full pointer-events-none flex items-center gap-1.5 shadow-sm">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <circle cx="11" cy="11" r="8" />
                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                        <line x1="11" y1="8" x2="11" y2="14" />
                        <line x1="8" y1="11" x2="14" y2="11" />
                      </svg>
                      Hover to magnify values
                    </div>
                  )}

                  {isHoverZooming && (
                    <div className="absolute top-2 left-2 bg-teal-800/85 backdrop-blur-xs text-white text-[10px] font-bold px-2 py-0.5 rounded pointer-events-none">
                      {zoomLevel}x Magnified
                    </div>
                  )}
                </div>

                {/* Multiple Pages Selector Thumbnails */}
                {images.length > 1 && (
                  <div className="flex items-center gap-2 overflow-x-auto pt-1 pb-1">
                    {images.map((img, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setActiveImageIndex(idx)}
                        className={`relative rounded-md border-2 overflow-hidden w-14 h-14 shrink-0 transition-all ${
                          activeImageIndex === idx
                            ? 'border-teal-600 ring-2 ring-teal-200 scale-105'
                            : 'border-ink-200 opacity-60 hover:opacity-100'
                        }`}
                      >
                        <img
                          src={`data:${img.mimeType};base64,${img.dataBase64}`}
                          alt={`Thumbnail ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Report Information Card */}
          <Card header={<h2 className="text-base font-bold text-ink-900">Report Details</h2>}>
            <div className="space-y-4">
              <Field id="rep-title" label="Report Title" required>
                <Input
                  value={reportTitle}
                  onChange={(e) => setReportTitle(e.target.value)}
                  placeholder="e.g. Complete Blood Picture (CBC)"
                />
              </Field>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field id="rep-lab" label="Laboratory Name">
                  <Input
                    value={labName}
                    onChange={(e) => setLabName(e.target.value)}
                    placeholder="e.g. Chughtai Lab, Aga Khan"
                  />
                </Field>

                <Field id="rep-date" label="Report Date" required>
                  <Input
                    type="date"
                    value={reportDate}
                    onChange={(e) => setReportDate(e.target.value)}
                  />
                </Field>
              </div>

              {pendingOrders.length > 0 && (
                <Field id="rep-link" label="Link to Doctor Test Order" hint="Completes the pending order on save">
                  <Select
                    id="rep-link"
                    value={selectedOrderId}
                    onValueChange={(val) => setSelectedOrderId(val)}
                    placeholder="-- Standalone report --"
                    options={[
                      { value: '', label: '-- Standalone report --' },
                      ...pendingOrders.map((order) => ({
                        value: order.id,
                        label: `${order.test_name} (Ordered ${order.ordered_date})`,
                      })),
                    ]}
                  />
                </Field>
              )}
            </div>
          </Card>
        </div>

        {/* Right Column (7/12): Extracted Test Results Table */}
        <div className="lg:col-span-7 space-y-6">
          <Card
            header={
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-ink-900">Extracted Results ({results.length})</h2>
                  <p className="text-xs text-ink-500">Reference ranges are evaluated automatically on your device.</p>
                </div>
                <Button variant="secondary" size="sm" onClick={handleAddResult}>
                  + Add Test Row
                </Button>
              </div>
            }
          >
            <div className="space-y-4">
              {results.length === 0 ? (
                <div className="text-center py-8 text-sm text-ink-500">
                  No test results added yet. Click "+ Add Test Row" above.
                </div>
              ) : (
                results.map((r, idx) => {
                  const isLowConf = r.confidence === 'low';
                  const evalResult = evaluateLabResult(r.value_text, r.reference_range, profileSex);

                  let badgeTone: 'ok' | 'warn' | 'neutral' = 'neutral';
                  let badgeLabel = 'Unevaluated';

                  if (evalResult.status === 'within_range') {
                    badgeTone = 'ok';
                    badgeLabel = 'Within typical range';
                  } else if (evalResult.status === 'outside_range') {
                    badgeTone = 'warn';
                    badgeLabel = 'Outside typical range';
                  } else if (evalResult.status === 'qualitative') {
                    badgeTone = 'neutral';
                    badgeLabel = 'Qualitative';
                  }

                  return (
                    <div
                      key={r.id}
                      className={`p-4 rounded-[var(--radius-lg)] border ${
                        isLowConf
                          ? 'border-warn-border bg-warn-bg/20'
                          : 'border-ink-200 bg-white'
                      } space-y-3 shadow-[var(--shadow-card)]`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-ink-500 uppercase tracking-wider">
                          Test #{idx + 1}
                        </span>
                        <div className="flex items-center gap-2">
                          {isLowConf && <Badge tone="warn" size="sm">Check this</Badge>}
                          <Badge tone={badgeTone} size="sm">{badgeLabel}</Badge>
                          <button
                            type="button"
                            onClick={() => handleRemoveResult(r.id)}
                            className="text-xs text-red-600 hover:text-red-800 font-medium p-1 ml-1"
                          >
                            Remove
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Field id={`res-name-${r.id}`} label="Test Parameter Name" required>
                          <Input
                            value={r.test_name}
                            onChange={(e) => handleUpdateResult(r.id, { test_name: e.target.value })}
                            placeholder="e.g. Hemoglobin"
                          />
                        </Field>

                        <div className="grid grid-cols-2 gap-2">
                          <Field id={`res-val-${r.id}`} label="Result Value" required>
                            <Input
                              value={r.value_text}
                              onChange={(e) => handleUpdateResult(r.id, { value_text: e.target.value })}
                              placeholder="e.g. 14.2 or Negative"
                            />
                          </Field>

                          <Field id={`res-unit-${r.id}`} label="Unit">
                            <Input
                              value={r.unit || ''}
                              onChange={(e) => handleUpdateResult(r.id, { unit: e.target.value })}
                              placeholder="e.g. g/dL, mg/dL"
                            />
                          </Field>
                        </div>
                      </div>

                      <Field
                        id={`res-ref-${r.id}`}
                        label="Reference Range (as printed on report)"
                        hint="e.g. 13.0 - 17.0, < 200, or Negative"
                      >
                        <Input
                          value={r.reference_range || ''}
                          onChange={(e) => handleUpdateResult(r.id, { reference_range: e.target.value })}
                          placeholder="e.g. 13.0 - 17.0"
                        />
                      </Field>
                    </div>
                  );
                })
              )}
            </div>
          </Card>

          {/* Reference Range Clinical Note */}
          <Disclaimer text={REPORT_OUT_OF_RANGE_NOTE} />
        </div>
      </div>

      {/* Fullscreen High-Resolution Lightbox Modal */}
      {isModalOpen && activeImg && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-ink-900/90 backdrop-blur-md flex flex-col items-center justify-center p-4"
          onClick={() => setIsModalOpen(false)}
        >
          <div className="relative max-w-5xl max-h-[90vh] w-full flex flex-col items-center">
            <div className="w-full flex items-center justify-between text-white mb-2">
              <span className="text-sm font-semibold">
                Page {activeImageIndex + 1} of {images.length}
              </span>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-3 py-1 bg-white/20 hover:bg-white/30 rounded text-sm font-bold"
              >
                Close (Esc)
              </button>
            </div>
            <img
              src={`data:${activeImg.mimeType};base64,${activeImg.dataBase64}`}
              alt="Lab report fullscreen"
              className="max-h-[82vh] max-w-full object-contain rounded-lg border border-white/20 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </AppShell>
  );
}
