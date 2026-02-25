import { useEffect, useRef } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { renderPageToCanvas } from '../core/pdfLoader';
import styles from './PageCanvas.module.css';

interface PageCanvasProps {
  document: PDFDocumentProxy;
  pageIndex: number;
  scale: number;
  onCanvasReady?: (canvas: HTMLCanvasElement) => void;
}

export function PageCanvas({ document, pageIndex, scale, onCanvasReady }: PageCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handle = renderPageToCanvas(document, pageIndex, canvas, scale);
    handle.promise.then(() => {
      if (onCanvasReady) {
        onCanvasReady(canvas);
      }
    }).catch((err) => {
      if (err instanceof Error && err.message === 'Rendering cancelled') return;
      console.warn(`[PageCanvas] render page ${pageIndex} failed:`, err);
    });

    return () => {
      handle.cancel();
    };
  }, [document, pageIndex, scale, onCanvasReady]);

  return <canvas ref={canvasRef} className={styles.canvas} />;
}
