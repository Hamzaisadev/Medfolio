import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AppShell } from '../../components/layout/AppShell';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ErrorState } from '../../components/ui/ErrorState';
import { Disclaimer } from '../../components/ui/Disclaimer';
import { LabFlaskIcon } from '../../components/ui/icons';
import { optimizeMedicalImage, type ProcessedImage } from '../../lib/files/imagePipeline';
import { extractLabReport } from '../../lib/ai/client';
import { testOrdersRepo } from '../../lib/db';
import { enhanceDocumentImage } from '../../lib/imageEnhancer';
import type { Tables } from '../../lib/supabase/types';
import { EXTRACTION_DISCLAIMER } from '../../lib/disclaimer';

type TestOrder = Tables<'test_orders'>;

import { useAuth } from '../../lib/auth/AuthContext';

export function CaptureReportPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile } = useAuth();
  const stateLinkedOrderId = (location.state as { linkedOrderId?: string } | null)?.linkedOrderId;

  const [images, setImages] = useState<ProcessedImage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [useEnhancedContrast, setUseEnhancedContrast] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [pendingOrders, setPendingOrders] = useState<TestOrder[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string>(stateLinkedOrderId || '');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const effectiveUserId = user?.id || profile?.user_id || '';

  // Load pending test orders to suggest auto-linking
  useEffect(() => {
    async function loadPending() {
      if (!effectiveUserId) return;
      try {
        const list = await testOrdersRepo.listPendingTestOrders(effectiveUserId);
        setPendingOrders(list);
      } catch (err) {
        console.error('Failed to load pending test orders:', err);
      }
    }
    loadPending();
  }, [effectiveUserId]);

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setErrorMessage(null);

    const newFiles = Array.from(fileList);
    if (images.length + newFiles.length > 10) {
      setErrorMessage('You can upload a maximum of 10 pages per lab report.');
      return;
    }

    try {
      const processed: ProcessedImage[] = [];
      for (const file of newFiles) {
        const res = await optimizeMedicalImage(file);
        processed.push(res);
      }
      setImages((prev) => [...prev, ...processed]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to process image';
      setErrorMessage(msg);
    }
  };

  const handleRemoveImage = (index: number) => {
    setImages((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleProcess = async () => {
    if (images.length === 0) {
      setErrorMessage('Please add at least one lab report photo or PDF page.');
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      // Enhance images if contrast enhancement is active
      const finalImages: ProcessedImage[] = [];
      for (const img of images) {
        if (useEnhancedContrast) {
          const rawBase64 = `data:${img.mimeType};base64,${img.dataBase64}`;
          const enhanced = await enhanceDocumentImage(rawBase64, {
            contrast: 1.4,
            gamma: 0.75,
            grayscale: true,
          });
          finalImages.push({
            ...img,
            dataBase64: enhanced.replace(/^data:[^;]+;base64,/, ''),
            mimeType: 'image/jpeg',
          });
        } else {
          finalImages.push(img);
        }
      }

      const res = await extractLabReport({
        images: finalImages.map((img) => ({
          mimeType: img.mimeType,
          dataBase64: img.dataBase64,
        })),
      });

      navigate('/reports/review', {
        state: {
          draft: res.data,
          rawResponse: res.raw_response,
          model: res.model,
          images,
          linkedOrderId: selectedOrderId || undefined,
        },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to extract lab report';
      setErrorMessage(msg);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleManualEntry = () => {
    navigate('/reports/review', {
      state: {
        draft: {
          readable: true,
          title: 'Lab Report',
          lab_name: '',
          report_date: new Date().toISOString().split('T')[0],
          results: [],
        },
        images: [],
        linkedOrderId: selectedOrderId || undefined,
        manual: true,
      },
    });
  };

  return (
    <AppShell>
      <PageHeader
        title="Add Lab Report"
        description="Photograph test results or upload a lab PDF to extract and track test parameters over time."
      />

      <div className="max-w-2xl mx-auto space-y-6">
        {errorMessage && (
          <ErrorState
            title="Couldn't read lab report"
            message={errorMessage}
            onRetry={handleProcess}
            fallbackAction={
              <Button variant="primary" size="sm" onClick={handleManualEntry}>
                Enter details manually
              </Button>
            }
          />
        )}

        {/* Optional: Link to a Pending Test Order */}
        {pendingOrders.length > 0 && (
          <Card
            header={
              <div className="flex items-center gap-2">
                <LabFlaskIcon size={18} className="text-teal-700" />
                <h2 className="text-sm font-bold text-ink-900">Link to Doctor Order (Optional)</h2>
              </div>
            }
          >
            <div className="space-y-2">
              <p className="text-xs text-ink-600">
                If your doctor ordered tests during a visit, select it here to mark it completed when this report is saved:
              </p>
              <select
                value={selectedOrderId}
                onChange={(e) => setSelectedOrderId(e.target.value)}
                className="w-full h-11 px-3.5 py-2 text-sm bg-surface-primary border border-ink-200 rounded-[var(--radius-md)] text-ink-900 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600"
              >
                <option value="">-- Do not link / Standalone report --</option>
                {pendingOrders.map((order) => (
                  <option key={order.id} value={order.id}>
                    {order.test_name} (Ordered on {order.ordered_date})
                  </option>
                ))}
              </select>
            </div>
          </Card>
        )}

        {/* Capture Buttons */}
        <Card>
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf"
              multiple
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />

            <Button
              variant="primary"
              className="w-full sm:w-auto flex-1 h-12"
              onClick={() => cameraInputRef.current?.click()}
            >
              Take Photo of Report
            </Button>
            <Button
              variant="secondary"
              className="w-full sm:w-auto flex-1 h-12"
              onClick={() => fileInputRef.current?.click()}
            >
              Choose Photos / PDF
            </Button>
          </div>
        </Card>

        {/* Selected Images Grid */}
        {images.length > 0 && (
          <Card
            header={
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-ink-900">
                  Attached Pages ({images.length} of 10)
                </span>
                
                {/* Contrast Enhancer Toggle */}
                <button
                  type="button"
                  onClick={() => setUseEnhancedContrast(!useEnhancedContrast)}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border ${
                    useEnhancedContrast
                      ? 'bg-teal-50 border-teal-300 text-teal-900 shadow-2xs'
                      : 'bg-ink-100 border-ink-200 text-ink-600'
                  }`}
                >
                  <span>✨</span>
                  <span>{useEnhancedContrast ? 'Handwriting Contrast: Enhanced' : 'Handwriting Contrast: Original'}</span>
                </button>
              </div>
            }
          >
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {images.map((img, idx) => (
                <div key={idx} className="relative group rounded-md border border-ink-200 overflow-hidden bg-ink-100 aspect-3/4">
                  <img
                    src={`data:${img.mimeType};base64,${img.dataBase64}`}
                    alt={`Report page ${idx + 1}`}
                    className={`w-full h-full object-cover transition-all ${
                      useEnhancedContrast ? 'contrast-125 brightness-95 grayscale' : ''
                    }`}
                  />
                  <span className="absolute bottom-1 left-1 bg-ink-900/70 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                    Page {idx + 1}
                  </span>
                  {useEnhancedContrast && (
                    <div className="absolute top-1 left-1 bg-teal-800/90 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                      ✨ Enhanced
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => handleRemoveImage(idx)}
                    className="absolute top-1 right-1 bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shadow-sm opacity-90 hover:opacity-100"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-5 flex items-center justify-between pt-4 border-t border-ink-100">
              <Button variant="ghost" size="sm" onClick={() => setImages([])}>
                Clear all
              </Button>
              <Button
                variant="primary"
                onClick={handleProcess}
                loading={isProcessing}
              >
                Extract Lab Results
              </Button>
            </div>
          </Card>
        )}

        {/* Fallback Manual Flow */}
        <div className="text-center pt-2">
          <p className="text-xs text-ink-500 mb-2">Prefer not to use camera?</p>
          <Button variant="ghost" size="sm" onClick={handleManualEntry}>
            Enter lab results manually instead &rarr;
          </Button>
        </div>

        <Disclaimer text={EXTRACTION_DISCLAIMER} />
      </div>
    </AppShell>
  );
}
