import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetViewport = vi.fn();
const mockRender = vi.fn();
const mockGetPage = vi.fn();
const mockDocument = {
  numPages: 2,
  getPage: mockGetPage,
};

vi.mock('pdfjs-dist', () => ({
  getDocument: vi.fn(() => ({ promise: Promise.resolve(mockDocument) })),
  GlobalWorkerOptions: { workerSrc: '' },
}));

import { loadPdf, renderPageToCanvas } from '../pdfLoader';
import * as pdfjsLib from 'pdfjs-dist';

beforeEach(() => {
  vi.clearAllMocks();
  mockGetViewport.mockReturnValue({ width: 595, height: 842 });
  mockRender.mockReturnValue({ promise: Promise.resolve(), cancel: vi.fn() });
  mockGetPage.mockResolvedValue({
    getViewport: mockGetViewport,
    render: mockRender,
  });
});

describe('loadPdf', () => {
  it('returns document, pageCount, and pageDimensions', async () => {
    const data = new Uint8Array([1, 2, 3]);
    const result = await loadPdf(data);

    expect(result.document).toBe(mockDocument);
    expect(result.pageCount).toBe(2);
    expect(result.pageDimensions).toEqual([
      { width: 595, height: 842 },
      { width: 595, height: 842 },
    ]);
  });

  it('calls getDocument with a copy of input data', async () => {
    const data = new Uint8Array([1, 2, 3]);
    await loadPdf(data);

    const call = vi.mocked(pdfjsLib.getDocument).mock.calls[0][0] as { data: Uint8Array };
    expect(call.data).toEqual(data);
    expect(call.data).not.toBe(data);
  });

  it('iterates all pages (1-indexed) to build pageDimensions', async () => {
    await loadPdf(new Uint8Array([1]));

    expect(mockGetPage).toHaveBeenCalledTimes(2);
    expect(mockGetPage).toHaveBeenCalledWith(1);
    expect(mockGetPage).toHaveBeenCalledWith(2);
  });
});

describe('renderPageToCanvas', () => {
  it('sets canvas dimensions and calls page.render', async () => {
    const canvas = document.createElement('canvas');
    const handle = renderPageToCanvas(mockDocument as never, 0, canvas, 2.0);
    await handle.promise;

    expect(mockGetPage).toHaveBeenCalledWith(1);
    expect(mockGetViewport).toHaveBeenCalledWith({ scale: 2.0 });
    expect(canvas.width).toBe(595);
    expect(canvas.height).toBe(842);
    expect(mockRender).toHaveBeenCalled();
  });

  it('cancel() prevents render when called before getPage resolves', async () => {
    let resolveGetPage!: (val: unknown) => void;
    mockGetPage.mockReturnValue(new Promise((r) => { resolveGetPage = r; }));

    const canvas = document.createElement('canvas');
    const handle = renderPageToCanvas(mockDocument as never, 0, canvas, 1.0);
    handle.cancel();

    resolveGetPage({ getViewport: mockGetViewport, render: mockRender });
    await expect(handle.promise).rejects.toThrow('Rendering cancelled');

    expect(mockRender).not.toHaveBeenCalled();
  });

  it('cancel() calls renderTask.cancel() when render is in progress', async () => {
    const mockCancel = vi.fn();
    let resolveRender!: () => void;
    mockRender.mockReturnValue({
      promise: new Promise<void>((r) => { resolveRender = r; }),
      cancel: mockCancel,
    });

    const canvas = document.createElement('canvas');
    const handle = renderPageToCanvas(mockDocument as never, 0, canvas, 1.0);

    // Wait for render to start (getPage resolved, render called)
    await vi.waitFor(() => expect(mockRender).toHaveBeenCalled());

    handle.cancel();
    expect(mockCancel).toHaveBeenCalled();

    resolveRender();
    await handle.promise;
  });
});
