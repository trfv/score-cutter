import { describe, it, expect } from 'vitest';
import { PDFDocument, rgb } from 'pdf-lib';
import { assemblePart, defaultAssemblyOptions } from '../partAssembler';
import type { Staff } from '../staffModel';

async function createTestPdf(pageCount: number = 1): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pageCount; i++) {
    const page = doc.addPage([595, 842]); // A4
    // Draw content so the page has a Contents stream (required for embedPage)
    page.drawRectangle({ x: 0, y: 0, width: 595, height: 842, color: rgb(1, 1, 1) });
  }
  return doc.save();
}

describe('partAssembler', () => {
  it('should create a PDF with one staff from one page', async () => {
    const sourcePdf = await createTestPdf(1);
    const staffs: Staff[] = [
      { id: '1', pageIndex: 0, top: 742, bottom: 642, label: 'Violin I', systemIndex: 0 },
    ];

    const outputBytes = await assemblePart(sourcePdf, staffs, defaultAssemblyOptions);
    const outputDoc = await PDFDocument.load(outputBytes);
    expect(outputDoc.getPageCount()).toBe(1);
  });

  it('should create a PDF with multiple staffs across pages', async () => {
    const sourcePdf = await createTestPdf(2);
    const staffs: Staff[] = [
      { id: '1', pageIndex: 0, top: 742, bottom: 642, label: 'Violin I', systemIndex: 0 },
      { id: '2', pageIndex: 1, top: 742, bottom: 642, label: 'Violin I', systemIndex: 0 },
    ];

    const outputBytes = await assemblePart(sourcePdf, staffs, defaultAssemblyOptions);
    const outputDoc = await PDFDocument.load(outputBytes);
    expect(outputDoc.getPageCount()).toBeGreaterThanOrEqual(1);
  });

  it('should start a new page when staffs overflow', async () => {
    const sourcePdf = await createTestPdf(1);
    // Create many tall staffs that won't fit on one page
    const staffs: Staff[] = Array.from({ length: 5 }, (_, i) => ({
      id: String(i),
      pageIndex: 0,
      top: 742,
      bottom: 542,  // 200pt tall each
      label: 'Violin I',
      systemIndex: 0,
    }));

    const outputBytes = await assemblePart(sourcePdf, staffs, defaultAssemblyOptions);
    const outputDoc = await PDFDocument.load(outputBytes);
    expect(outputDoc.getPageCount()).toBeGreaterThan(1);
  });

  it('should return valid PDF bytes', async () => {
    const sourcePdf = await createTestPdf(1);
    const staffs: Staff[] = [
      { id: '1', pageIndex: 0, top: 742, bottom: 642, label: 'Violin I', systemIndex: 0 },
    ];

    const outputBytes = await assemblePart(sourcePdf, staffs, defaultAssemblyOptions);
    // Should start with %PDF header
    const header = String.fromCharCode(...outputBytes.slice(0, 5));
    expect(header).toBe('%PDF-');
  });
});
