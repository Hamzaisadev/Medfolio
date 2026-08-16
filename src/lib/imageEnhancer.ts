/**
 * Client-Side Medical Document Image Enhancer
 * Applies adaptive contrast, grayscale conversion, and gamma stretching
 * to make faded doctor handwriting and low-contrast prescription slips legible for OCR.
 */

export interface EnhancementOptions {
  contrast?: number; // 0 to 2 (1 = normal, 1.4 = high contrast)
  brightness?: number; // -100 to 100
  gamma?: number; // e.g. 0.7 to boost dark text
  grayscale?: boolean;
}

export function enhanceDocumentImage(
  dataUrl: string,
  options: EnhancementOptions = { contrast: 1.4, brightness: 5, gamma: 0.75, grayscale: true }
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }

        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        const contrast = options.contrast ?? 1.4;
        const brightness = options.brightness ?? 5;
        const gamma = options.gamma ?? 0.75;
        const isGrayscale = options.grayscale ?? true;

        // Precompute gamma lookup table (LUT)
        const gammaLUT = new Uint8Array(256);
        for (let i = 0; i < 256; i++) {
          gammaLUT[i] = Math.min(255, Math.max(0, Math.pow(i / 255, gamma) * 255));
        }

        const factor = (259 * (contrast * 100 + 255)) / (255 * (259 - contrast * 100));

        for (let i = 0; i < data.length; i += 4) {
          let r = data[i]!;
          let g = data[i + 1]!;
          let b = data[i + 2]!;

          if (isGrayscale) {
            // Rec. 709 Luminance weights for medical documents
            const gray = 0.2126 * r + 0.7152 * g + 0.0722 * b;
            r = gray;
            g = gray;
            b = gray;
          }

          // Apply contrast & brightness
          r = factor * (r - 128) + 128 + brightness;
          g = factor * (g - 128) + 128 + brightness;
          b = factor * (b - 128) + 128 + brightness;

          // Clamp & apply gamma
          const rClamped = Math.min(255, Math.max(0, Math.round(r)));
          const gClamped = Math.min(255, Math.max(0, Math.round(g)));
          const bClamped = Math.min(255, Math.max(0, Math.round(b)));

          data[i] = gammaLUT[rClamped]!;
          data[i + 1] = gammaLUT[gClamped]!;
          data[i + 2] = gammaLUT[bClamped]!;
        }

        ctx.putImageData(imageData, 0, 0);
        resolve(canvas.toDataURL('image/jpeg', 0.9));
      } catch (err) {
        console.error('Document enhancement failed:', err);
        resolve(dataUrl);
      }
    };
    img.onerror = () => reject(new Error('Failed to load image for enhancement'));
    img.src = dataUrl;
  });
}
