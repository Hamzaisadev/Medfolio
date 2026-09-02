import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export interface PdfExportOptions {
  filename?: string;
  marginMm?: number;
  scale?: number;
  quality?: number;
}

/**
 * Exports a given HTML DOM element directly as a downloaded PDF file.
 * Automatically computes A4 proportions and multi-page splits if needed.
 */
export async function exportElementToPdf(
  element: HTMLElement,
  options: PdfExportOptions = {}
): Promise<void> {
  const {
    filename = 'Clinical_Document.pdf',
    marginMm = 10,
    scale = 2,
  } = options;

  // Save original styles if needed
  const originalBackground = element.style.backgroundColor;
  element.style.backgroundColor = '#ffffff';

  try {
    const canvas = await html2canvas(element, {
      scale: Math.max(scale, 2),
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: element.scrollWidth,
      ignoreElements: (el) => {
        return (
          el.classList.contains('print:hidden') ||
          el.hasAttribute('data-pdf-ignore') ||
          el.tagName === 'HEADER' ||
          el.tagName === 'NAV'
        );
      },
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.98);

    // Standard A4 Dimensions in mm
    const pdfWidth = 210;
    const pdfHeight = 297;
    const margin = marginMm;
    const contentWidth = pdfWidth - margin * 2;

    const imgWidth = contentWidth;
    const imgHeight = (canvas.height * contentWidth) / canvas.width;

    const pdf = new jsPDF('p', 'mm', 'a4');
    let heightLeft = imgHeight;
    let position = margin;
    const pageContentHeight = pdfHeight - margin * 2;

    // First page
    pdf.addImage(imgData, 'JPEG', margin, position, imgWidth, imgHeight, undefined, 'FAST');
    heightLeft -= pageContentHeight;

    // Multi-page handling if content is long
    while (heightLeft > 0) {
      position = heightLeft - imgHeight + margin;
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', margin, position, imgWidth, imgHeight, undefined, 'FAST');
      heightLeft -= pageContentHeight;
    }

    const cleanFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
    pdf.save(cleanFilename);
  } finally {
    element.style.backgroundColor = originalBackground;
  }
}
