import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '../../components/layout/AppShell';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Disclaimer } from '../../components/ui/Disclaimer';
import { ErrorState } from '../../components/ui/ErrorState';
import { SparklesIcon, XIcon } from '../../components/ui/icons';
import { EXTRACTION_DISCLAIMER } from '../../lib/disclaimer';
import { optimizeMedicalImage, ProcessedImage } from '../../lib/files/imagePipeline';
import { extractPrescription } from '../../lib/ai/client';
import { enhanceDocumentImage } from '../../lib/imageEnhancer';

export function CapturePrescriptionPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [images, setImages] = useState<Array<{ id: string; file: File; previewUrl: string; enhancedUrl?: string; processed?: ProcessedImage }>>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [useEnhancedContrast, setUseEnhancedContrast] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setErrorMessage(null);

    const newItems: Array<{ id: string; file: File; previewUrl: string; enhancedUrl?: string }> = [];
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      if (file && (file.type.startsWith('image/') || file.type === 'application/pdf')) {
        const previewUrl = URL.createObjectURL(file);
        newItems.push({
          id: `${Date.now()}-${i}-${Math.random().toString(36).substr(2, 9)}`,
          file,
          previewUrl,
        });
      }
    }

    setImages((prev) => [...prev, ...newItems].slice(0, 5));
  };

  const handleRemoveImage = (id: string) => {
    setImages((prev) => prev.filter((img) => img.id !== id));
  };

  const handleProcess = async () => {
    if (images.length === 0) return;
    setIsProcessing(true);
    setErrorMessage(null);

    try {
      // Step 1: Pre-process each image on client (EXIF strip, resize max 2000px, WebP q0.82)
      const processedList: ProcessedImage[] = [];
      for (const item of images) {
        let optimized = await optimizeMedicalImage(item.file);
        
        // If handwriting enhancer is enabled, enhance contrast & binarization for Gemini OCR
        if (useEnhancedContrast) {
          const rawBase64 = `data:${optimized.mimeType};base64,${optimized.dataBase64}`;
          const enhancedDataUrl = await enhanceDocumentImage(rawBase64, {
            contrast: 1.4,
            gamma: 0.75,
            grayscale: true,
          });
          const cleanBase64 = enhancedDataUrl.replace(/^data:[^;]+;base64,/, '');
          optimized = {
            ...optimized,
            dataBase64: cleanBase64,
            mimeType: 'image/jpeg',
          };
        }

        processedList.push(optimized);
      }

      // Step 2: Send structured base64 payload to /api/extract-prescription
      const res = await extractPrescription({
        images: processedList.map((p) => ({
          mimeType: p.mimeType,
          dataBase64: p.dataBase64,
        })),
      });

      // Pass extracted draft data and images into Review state
      navigate('/prescriptions/review', {
        state: {
          draft: res.data,
          rawResponse: res.raw_response,
          model: res.model,
          images: processedList,
        },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to process prescription';
      setErrorMessage(msg);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleManualEntry = () => {
    navigate('/prescriptions/review', {
      state: {
        draft: {
          doctor_name: '',
          clinic_name: '',
          visit_date: new Date().toISOString().split('T')[0],
          diagnosis: '',
          doctor_advice: '',
          medicines: [
            {
              medicine_name: '',
              strength: '',
              form: 'tablet',
              dose_amount: '1 tablet',
              frequency_raw: 'OD',
              duration_raw: '5 days',
              with_food: true,
              instructions: '',
            },
          ],
        },
        images: [],
      },
    });
  };

  return (
    <AppShell>
      <div className="space-y-6 max-w-2xl mx-auto">
        <PageHeader
          title="Scan Doctor Prescription"
          description="Take a photo or upload an existing prescription. Our vision engine will extract medications, doses, and schedules."
        />

        {errorMessage && (
          <ErrorState
            title="Scan Failed"
            message={errorMessage}
            onRetry={handleProcess}
          />
        )}

        {/* Action Options */}
        <Card>
          <div className="flex flex-col sm:flex-row gap-3">
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
              className="w-full sm:flex-1"
              onClick={() => cameraInputRef.current?.click()}
              leftIcon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              }
            >
              Take Photo
            </Button>

            <Button
              variant="secondary"
              className="w-full sm:flex-1"
              onClick={() => fileInputRef.current?.click()}
              leftIcon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              }
            >
              Upload Photos / PDF
            </Button>
          </div>

          <p className="mt-3 text-xs text-center text-ink-500">
            Up to 5 pages per prescription. Photos are processed and compressed securely.
          </p>
        </Card>

        {/* Selected Image Previews with Handwriting Contrast Enhancer */}
        {images.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-ink-900">Attached Pages ({images.length}/5)</h2>
              
              {/* Handwriting Enhancer Switch */}
              <button
                type="button"
                onClick={() => setUseEnhancedContrast(!useEnhancedContrast)}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border ${
                  useEnhancedContrast
                    ? 'bg-teal-50 border-teal-300 text-teal-900 shadow-2xs'
                    : 'bg-ink-100 border-ink-200 text-ink-600'
                }`}
              >
                <SparklesIcon size={14} className={useEnhancedContrast ? 'text-teal-700' : 'text-ink-500'} />
                <span>{useEnhancedContrast ? 'Handwriting Contrast: Enhanced' : 'Handwriting Contrast: Original'}</span>
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {images.map((item, idx) => (
                <div
                  key={item.id}
                  className="relative group rounded-[var(--radius-lg)] border border-ink-300 overflow-hidden aspect-[3/4] bg-ink-100"
                >
                  <img
                    src={item.previewUrl}
                    alt={`Page ${idx + 1}`}
                    className={`w-full h-full object-cover transition-all ${
                      useEnhancedContrast ? 'contrast-125 brightness-95 grayscale' : ''
                    }`}
                  />
                  <div className="absolute top-2 left-2 bg-ink-900/80 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                    Page {idx + 1}
                  </div>
                  {useEnhancedContrast && (
                    <div className="absolute bottom-2 left-2 bg-teal-800/90 text-white text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1">
                      <SparklesIcon size={10} /> Enhanced
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => handleRemoveImage(item.id)}
                    aria-label={`Remove page ${idx + 1}`}
                    className="absolute top-2 right-2 p-1.5 bg-red-600/90 hover:bg-red-700 text-white rounded-full transition-colors shadow-sm flex items-center justify-center"
                  >
                    <XIcon size={12} />
                  </button>
                </div>
              ))}
            </div>

            <div className="pt-3 flex flex-col gap-3">
              <Button
                variant="primary"
                size="lg"
                loading={isProcessing}
                onClick={handleProcess}
                className="w-full"
              >
                {isProcessing ? 'Reading Prescription...' : 'Extract Prescription Details'}
              </Button>
            </div>
          </div>
        )}

        {/* Manual Fallback Action */}
        <div className="text-center pt-2">
          <Button variant="ghost" onClick={handleManualEntry} className="text-ink-600">
            Or enter prescription details manually
          </Button>
        </div>

        <Disclaimer text={EXTRACTION_DISCLAIMER} />
      </div>
    </AppShell>
  );
}
