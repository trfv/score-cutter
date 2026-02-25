import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy } from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = `${import.meta.env.BASE_URL}pdf.worker.min.mjs`;

interface LoadedPdf {
  document: PDFDocumentProxy;
  pageCount: number;
  pageDimensions: { width: number; height: number }[];
}

export async function loadPdf(data: Uint8Array): Promise<LoadedPdf> {
  // Copy so PDF.js worker transfer doesn't detach the caller's buffer
  const document = await pdfjsLib.getDocument({ data: data.slice() }).promise;
  const pageCount = document.numPages;
  const pageDimensions: { width: number; height: number }[] = [];

  for (let i = 1; i <= pageCount; i++) {
    const page = await document.getPage(i);
    const viewport = page.getViewport({ scale: 1.0 });
    pageDimensions.push({ width: viewport.width, height: viewport.height });
  }

  return { document, pageCount, pageDimensions };
}

interface RenderHandle {
  promise: Promise<void>;
  cancel: () => void;
}

export function renderPageToCanvas(
  document: PDFDocumentProxy,
  pageIndex: number,
  canvas: HTMLCanvasElement,
  scale: number,
): RenderHandle {
  let renderTask: ReturnType<import('pdfjs-dist').PDFPageProxy['render']> | null = null;
  let cancelled = false;

  const promise = (async () => {
    const page = await document.getPage(pageIndex + 1);
    if (cancelled) throw new Error('Rendering cancelled');

    const viewport = page.getViewport({ scale });
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    renderTask = page.render({ canvas, viewport });
    await renderTask.promise;
  })();

  return {
    promise,
    cancel() {
      cancelled = true;
      renderTask?.cancel();
    },
  };
}
