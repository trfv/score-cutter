import { PDFDocument } from 'pdf-lib';
import type { Staff } from './staffModel';

export interface AssemblyOptions {
  pageWidth: number;
  pageHeight: number;
  marginTop: number;
  marginBottom: number;
  marginLeft: number;
  marginRight: number;
  gapBetweenStaffs: number;
}

export const defaultAssemblyOptions: AssemblyOptions = {
  pageWidth: 595,   // A4
  pageHeight: 842,  // A4
  marginTop: 36,
  marginBottom: 36,
  marginLeft: 36,
  marginRight: 36,
  gapBetweenStaffs: 18,
};

export async function assemblePart(
  sourcePdfBytes: Uint8Array,
  staffs: Staff[],
  options: AssemblyOptions = defaultAssemblyOptions,
): Promise<Uint8Array> {
  const sourceDoc = await PDFDocument.load(sourcePdfBytes);
  const outputDoc = await PDFDocument.create();

  const usableWidth = options.pageWidth - options.marginLeft - options.marginRight;
  const usableHeight = options.pageHeight - options.marginTop - options.marginBottom;

  let currentPage = outputDoc.addPage([options.pageWidth, options.pageHeight]);
  let cursorY = options.pageHeight - options.marginTop;

  for (const staff of staffs) {
    const sourcePage = sourceDoc.getPage(staff.pageIndex);
    const sourceWidth = sourcePage.getWidth();
    const height = staff.top - staff.bottom;

    const scale = usableWidth / sourceWidth;
    const scaledHeight = height * scale;

    if (cursorY - scaledHeight < options.marginBottom) {
      if (cursorY < options.pageHeight - options.marginTop) {
        currentPage = outputDoc.addPage([options.pageWidth, options.pageHeight]);
        cursorY = options.pageHeight - options.marginTop;
      }
    }

    // If a single staff is taller than usable height, still place it
    const effectiveHeight = Math.min(scaledHeight, usableHeight);

    const embeddedPage = await outputDoc.embedPage(sourcePage, {
      left: 0,
      right: sourceWidth,
      bottom: staff.bottom,
      top: staff.top,
    });

    currentPage.drawPage(embeddedPage, {
      x: options.marginLeft,
      y: cursorY - effectiveHeight,
      width: usableWidth,
      height: effectiveHeight,
    });

    cursorY -= effectiveHeight + options.gapBetweenStaffs;
  }

  return outputDoc.save();
}
