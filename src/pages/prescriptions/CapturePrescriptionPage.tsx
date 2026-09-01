import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { AppShell } from '../../components/layout/AppShell';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Disclaimer } from '../../components/ui/Disclaimer';
import { ErrorState } from '../../components/ui/ErrorState';
import { SparklesIcon, XIcon, CameraIcon, FileTextIcon } from '../../components/ui/icons';
import { EXTRACTION_DISCLAIMER } from '../../lib/disclaimer';
import { optimizeMedicalImage, ProcessedImage } from '../../lib/files/imagePipeline';
import { extractPrescription } from '../../lib/ai/client';
import { enhanceDocumentImage } from '../../lib/imageEnhancer';
import { staggerContainer, staggerItem } from '../../lib/motion';

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
      const processedList: ProcessedImage[] = [];
      for (const item of images) {
        let optimized = await optimizeMedicalImage(item.file);
        
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

      const res = await extractPrescription({
        images: processedList.map((p) => ({
          mimeType: p.mimeType,
          dataBase64: p.dataBase64,
        })),
      });

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
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="space-y-6 max-w-2xl mx-auto"
      >
        <motion.div variants={staggerItem}>
          <PageHeader
            title="Scan Doctor Prescription"
            description="Take a photo or upload an existing prescription. Our vision engine will extract medications, doses, and schedules."
          />
        </motion.div>

        {errorMessage && (
          <motion.div variants={staggerItem}>
            <ErrorState
              title="Scan Failed"
              message={errorMessage}
              onRetry={handleProcess}
            />
          </motion.div>
        )}

        {/* Action Options */}
        <motion.div variants={staggerItem}>
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
                leftIcon={<CameraIcon size={18} />}
              >
                Take Photo
              </Button>

              <Button
                variant="secondary"
                className="w-full sm:flex-1"
                onClick={() => fileInputRef.current?.click()}
                leftIcon={<FileTextIcon size={18} />}
              >
                Upload Photos / PDF
              </Button>
            </div>

            <p className="mt-3 text-xs text-center text-content-muted">
              Up to 5 pages per prescription. Photos are processed and compressed securely.
            </p>
          </Card>
        </motion.div>

        {/* Selected Image Previews with Handwriting Contrast Enhancer */}
        <AnimatePresence>
          {images.length > 0 && (
            <motion.div
              variants={staggerItem}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-3"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-content">Attached Pages ({images.length}/5)</h2>
                
                <button
                  type="button"
                  onClick={() => setUseEnhancedContrast(!useEnhancedContrast)}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border cursor-pointer ${
                    useEnhancedContrast
                      ? 'bg-accent-subtle border-accent/30 text-accent shadow-xs'
                      : 'bg-surface-sunken border-line text-content-muted hover:bg-surface-hover'
                  }`}
                >
                  <SparklesIcon size={14} className={useEnhancedContrast ? 'text-accent' : 'text-content-subtle'} />
                  <span>{useEnhancedContrast ? 'Handwriting Contrast: Enhanced' : 'Handwriting Contrast: Original'}</span>
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 relative">
                {images.map((item, idx) => (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ type: 'spring', stiffness: 450, damping: 30 }}
                    className="relative group rounded-[var(--radius-lg)] border border-line-strong overflow-hidden aspect-[3/4] bg-surface-sunken shadow-card"
                  >
                    <img
                      src={item.previewUrl}
                      alt={`Page ${idx + 1}`}
                      className={`w-full h-full object-cover transition-all ${
                        useEnhancedContrast ? 'contrast-125 brightness-95 grayscale' : ''
                      }`}
                    />
                    
                    {/* Scanning Laser Line when processing */}
                    {isProcessing && (
                      <motion.div
                        className="absolute inset-x-0 h-1 bg-accent shadow-md z-20"
                        animate={{ top: ['0%', '98%', '0%'] }}
                        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                      />
                    )}

                    <div className="absolute top-2 left-2 bg-ink-900/80 text-white text-[10px] font-bold px-2 py-0.5 rounded-full z-10">
                      Page {idx + 1}
                    </div>
                    {useEnhancedContrast && (
                      <div className="absolute bottom-2 left-2 bg-brand-800/90 text-white text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 z-10">
                        <SparklesIcon size={10} /> Enhanced
                      </div>
                    )}
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => handleRemoveImage(item.id)}
                      aria-label={`Remove page ${idx + 1}`}
                      className="absolute top-2 right-2 p-1.5 bg-risk-bg text-risk-text border border-risk-border hover:brightness-95 rounded-full transition-colors shadow-xs flex items-center justify-center cursor-pointer z-10 disabled:opacity-50"
                    >
                      <XIcon size={12} />
                    </button>
                  </motion.div>
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
            </motion.div>
          )}
        </AnimatePresence>

        {/* Manual Fallback Action */}
        <motion.div variants={staggerItem} className="text-center pt-2">
          <Button variant="ghost" onClick={handleManualEntry} className="text-content-muted">
            Or enter prescription details manually
          </Button>
        </motion.div>

        <motion.div variants={staggerItem}>
          <Disclaimer text={EXTRACTION_DISCLAIMER} />
        </motion.div>
      </motion.div>
    </AppShell>
  );
}
