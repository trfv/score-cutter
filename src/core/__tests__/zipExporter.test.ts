import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { PDFDocument, rgb } from 'pdf-lib';
import { zipParts } from '../zipExporter';
import { defaultAssemblyOptions } from '../partAssembler';
import type { Part } from '../staffModel';

async function createTestPdf(pageCount: number = 1): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pageCount; i++) {
    const page = doc.addPage([595, 842]);
    page.drawRectangle({ x: 0, y: 0, width: 595, height: 842, color: rgb(1, 1, 1) });
  }
  return doc.save();
}

describe('zipParts', () => {
  it('should return a valid ZIP containing one PDF per part', async () => {
    const sourcePdf = await createTestPdf(1);
    const parts: Part[] = [
      {
        label: 'Violin I',
        staffs: [{ id: '1', pageIndex: 0, top: 742, bottom: 642, label: 'Violin I', systemId: 'sys-0' }],
      },
      {
        label: 'Cello',
        staffs: [{ id: '2', pageIndex: 0, top: 542, bottom: 442, label: 'Cello', systemId: 'sys-0' }],
      },
    ];

    const zipBytes = await zipParts(sourcePdf, parts, defaultAssemblyOptions);
    const zip = await JSZip.loadAsync(zipBytes);
    const fileNames = Object.keys(zip.files);
    expect(fileNames).toContain('Violin_I.pdf');
    expect(fileNames).toContain('Cello.pdf');
    expect(fileNames.length).toBe(2);
  });

  it('should contain valid PDFs in the ZIP', async () => {
    const sourcePdf = await createTestPdf(1);
    const parts: Part[] = [
      {
        label: 'Violin I',
        staffs: [{ id: '1', pageIndex: 0, top: 742, bottom: 642, label: 'Violin I', systemId: 'sys-0' }],
      },
    ];

    const zipBytes = await zipParts(sourcePdf, parts, defaultAssemblyOptions);
    const zip = await JSZip.loadAsync(zipBytes);
    const pdfData = await zip.file('Violin_I.pdf')!.async('uint8array');
    const header = String.fromCharCode(...pdfData.slice(0, 5));
    expect(header).toBe('%PDF-');
  });

  it('should call progress callback for each part', async () => {
    const sourcePdf = await createTestPdf(1);
    const parts: Part[] = [
      {
        label: 'Violin I',
        staffs: [{ id: '1', pageIndex: 0, top: 742, bottom: 642, label: 'Violin I', systemId: 'sys-0' }],
      },
      {
        label: 'Cello',
        staffs: [{ id: '2', pageIndex: 0, top: 542, bottom: 442, label: 'Cello', systemId: 'sys-0' }],
      },
    ];

    const progressCalls: Array<{ currentPartIndex: number; totalParts: number; currentPartLabel: string }> = [];
    await zipParts(sourcePdf, parts, defaultAssemblyOptions, (progress) => {
      progressCalls.push({ ...progress });
    });

    expect(progressCalls).toEqual([
      { currentPartIndex: 0, totalParts: 2, currentPartLabel: 'Violin I' },
      { currentPartIndex: 1, totalParts: 2, currentPartLabel: 'Cello' },
    ]);
  });

  it('should return a valid empty ZIP when parts array is empty', async () => {
    const sourcePdf = await createTestPdf(1);
    const zipBytes = await zipParts(sourcePdf, [], defaultAssemblyOptions);
    const zip = await JSZip.loadAsync(zipBytes);
    expect(Object.keys(zip.files).length).toBe(0);
  });

  it('should replace spaces with underscores in file names', async () => {
    const sourcePdf = await createTestPdf(1);
    const parts: Part[] = [
      {
        label: 'Basso continuo',
        staffs: [{ id: '1', pageIndex: 0, top: 742, bottom: 642, label: 'Basso continuo', systemId: 'sys-0' }],
      },
    ];

    const zipBytes = await zipParts(sourcePdf, parts, defaultAssemblyOptions);
    const zip = await JSZip.loadAsync(zipBytes);
    expect(Object.keys(zip.files)).toContain('Basso_continuo.pdf');
  });
});
