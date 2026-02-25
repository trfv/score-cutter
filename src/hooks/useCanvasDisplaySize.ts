import { useCallback, useEffect, useRef, useState } from 'react';
import { getScale } from '../core/coordinateMapper';

const SCALE = getScale(150);

export function useCanvasDisplaySize() {
  const [bitmapWidth, setBitmapWidth] = useState(0);
  const [canvasWidth, setCanvasWidth] = useState(0);
  const [canvasHeight, setCanvasHeight] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const handleCanvasReady = useCallback((canvas: HTMLCanvasElement) => {
    canvasRef.current = canvas;
    setBitmapWidth(canvas.width);
    setCanvasWidth(canvas.clientWidth);
    setCanvasHeight(canvas.clientHeight);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const el = entry.target as HTMLCanvasElement;
        setCanvasWidth(prev => (prev !== el.clientWidth ? el.clientWidth : prev));
        setCanvasHeight(prev => (prev !== el.clientHeight ? el.clientHeight : prev));
      }
    });

    observer.observe(canvas);
    return () => observer.disconnect();
  }, [bitmapWidth]);

  const displayRatio = bitmapWidth > 0 ? canvasWidth / bitmapWidth : 1;
  const effectiveScale = SCALE * displayRatio;

  return { bitmapWidth, canvasWidth, canvasHeight, displayRatio, effectiveScale, handleCanvasReady };
}
