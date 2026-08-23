/**
 * Image Pre-Processing & Optimization Pipeline.
 *
 * Implements client-side image processing per 04-FEATURES.md & 01-ARCHITECTURE.md:
 * - Resize longest edge to max 2000px
 * - Compress to WebP where supported, JPEG otherwise
 * - Typical photo lands under 300 KB
 *
 * EXIF note: drawing through a canvas strips metadata. Browsers apply EXIF
 * orientation to `HTMLImageElement` before it is drawn, so the output is upright
 * without an explicit rotation step — but the reported `mimeType` must match the
 * bytes actually produced, which is what `pickOutputType` guarantees.
 */

export interface ProcessedImage {
  blob: Blob;
  dataBase64: string;
  mimeType: string;
  width: number;
  height: number;
  byteSize: number;
}

const MAX_DIMENSION = 2000;
const QUALITY = 0.82;

/**
 * Loads an image file or blob into an HTMLImageElement safely.
 */
function loadImage(file: Blob | File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image file'));
    };
    img.src = url;
  });
}

/**
 * Returns an output type the canvas can genuinely encode.
 *
 * `toDataURL('image/webp')` silently falls back to PNG where WebP encoding is
 * unsupported (older Safari), which previously produced PNG bytes labelled as
 * WebP and sent a mismatched mimeType to the extraction API.
 */
function pickOutputType(canvas: HTMLCanvasElement): string {
  for (const type of ['image/webp', 'image/jpeg']) {
    if (canvas.toDataURL(type, QUALITY).startsWith(`data:${type}`)) {
      return type;
    }
  }
  return 'image/png';
}

/**
 * Compresses and scales an image to a maximum 2000px longest edge.
 */
export async function optimizeMedicalImage(file: Blob | File): Promise<ProcessedImage> {
  const img = await loadImage(file);

  let width = img.naturalWidth || img.width;
  let height = img.naturalHeight || img.height;

  if (!width || !height) {
    throw new Error('Image has no readable dimensions');
  }

  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    if (width > height) {
      height = Math.max(1, Math.round((height * MAX_DIMENSION) / width));
      width = MAX_DIMENSION;
    } else {
      width = Math.max(1, Math.round((width * MAX_DIMENSION) / height));
      height = MAX_DIMENSION;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context unavailable');
  }

  ctx.drawImage(img, 0, 0, width, height);

  const mimeType = pickOutputType(canvas);

  // Encode once and derive both representations from the same bytes; encoding
  // separately via toDataURL and toBlob doubled the work and could disagree.
  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Failed to generate image blob'))),
      mimeType,
      QUALITY
    );
  });

  return {
    blob,
    dataBase64: await blobToBase64(blob),
    mimeType,
    width,
    height,
    byteSize: blob.size,
  };
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1] || '');
    };
    reader.onerror = () => reject(new Error('Failed encoding image to base64'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Converts a file directly into a base64 string for AI extraction.
 */
export function fileToBase64(file: Blob | File): Promise<string> {
  return blobToBase64(file);
}
