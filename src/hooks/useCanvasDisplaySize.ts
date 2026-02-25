import { useCallback, useState } from 'react';
import { getScale } from '../core/coordinateMapper';

const SCALE = getScale(150);

export function useCanvasDisplaySize() {
  const [bitmapWidth, setBitmapWidth] = useState(0);
  const [canvasWidth, setCanvasWidth] = useState(0);
  const [canvasHeight, setCanvasHeight] = useState(0);

  const handleCanvasReady = useCallback((canvas: HTMLCanvasElement) => {
    setBitmapWidth(canvas.width);
    setCanvasWidth(canvas.clientWidth);
    setCanvasHeight(canvas.clientHeight);
  }, []);

  const displayRatio = bitmapWidth > 0 ? canvasWidth / bitmapWidth : 1;
  const effectiveScale = SCALE * displayRatio;

  return { bitmapWidth, canvasWidth, canvasHeight, displayRatio, effectiveScale, handleCanvasReady };
}
