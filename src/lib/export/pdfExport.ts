import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export interface PdfExportOptions {
  filename?: string;
  marginMm?: number;
  scale?: number;
}

/**
 * Exports a given HTML DOM element directly as a downloaded PDF file.
 * Uses a temporary wrapper appended to the document body at full opacity
 * to ensure html2canvas can measure layout correctly, then hides it
 * before and after capture.
 */
export async function exportElementToPdf(
  element: HTMLElement,
  options: PdfExportOptions = {}
): Promise<void> {
  const {
    filename = 'Clinical_Document.pdf',
    marginMm = 8,
    scale = 2,
  } = options;

  // Temporarily force scroll to top so html2canvas captures from beginning
  const prevScrollY = window.scrollY;
  window.scrollTo(0, 0);

  // Temporarily override background in case dark mode is active
  const prevBg = element.style.backgroundColor;
  const prevColor = element.style.color;
  element.style.backgroundColor = '#ffffff';
  element.style.color = '#0f0f0f';

  // Small delay to let styles settle after scroll
  await new Promise((r) => setTimeout(r, 120));

  try {
    const canvas = await html2canvas(element, {
      scale: Math.max(scale, 2),
      useCORS: true,
      allowTaint: true,
      logging: false,
      backgroundColor: '#ffffff',
      // Capture the full scrollable height of the element
      height: element.scrollHeight,
      width: element.scrollWidth || element.offsetWidth,
      windowWidth: document.documentElement.scrollWidth,
      windowHeight: element.scrollHeight,
      scrollX: 0,
      scrollY: 0,
      // Ignore nav/header/floating elements
      ignoreElements: (el: Element) => {
        const tag = el.tagName?.toUpperCase();
        if (tag === 'HEADER' || tag === 'NAV') return true;
        const cls = el.classList;
        if (!cls) return false;
        // Tailwind print:hidden compiles to a rule but the class name stays
        if (cls.contains('print:hidden')) return true;
        if (el.hasAttribute('data-pdf-ignore')) return true;
        if (el.hasAttribute('data-floating-assistant')) return true;
        if (cls.contains('offline-banner')) return true;
        return false;
      },
    });

    // Validate canvas has content
    if (canvas.width === 0 || canvas.height === 0) {
      throw new Error('PDF canvas has zero dimensions — element may not be visible.');
    }

    const imgData = canvas.toDataURL('image/jpeg', 0.95);

    // A4 dimensions in mm
    const pdfWidthMm = 210;
    const pdfHeightMm = 297;
    const margin = marginMm;
    const contentWidthMm = pdfWidthMm - margin * 2;
    const imgHeightMm = (canvas.height * contentWidthMm) / canvas.width;

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    let heightLeft = imgHeightMm;
    let position = margin;
    const pageContentHeight = pdfHeightMm - margin * 2;

    // First page
    pdf.addImage(imgData, 'JPEG', margin, position, contentWidthMm, imgHeightMm, undefined, 'FAST');
    heightLeft -= pageContentHeight;

    // Additional pages if content is taller than one A4 page
    while (heightLeft > 0) {
      position = heightLeft - imgHeightMm + margin;
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', margin, position, contentWidthMm, imgHeightMm, undefined, 'FAST');
      heightLeft -= pageContentHeight;
    }

    const cleanFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
    pdf.save(cleanFilename);
  } finally {
    // Restore original styles
    element.style.backgroundColor = prevBg;
    element.style.color = prevColor;
    // Restore scroll position
    window.scrollTo(0, prevScrollY);
  }
}
