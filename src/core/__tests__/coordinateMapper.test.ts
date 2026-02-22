import { describe, it, expect } from 'vitest';
import {
  canvasYToPdfY,
  pdfYToCanvasY,
  getScale,
} from '../coordinateMapper';

describe('coordinateMapper', () => {
  const pdfPageHeight = 792; // Letter size in points
  const renderDpi = 150;
  const scale = renderDpi / 72; // ~2.083

  describe('getScale', () => {
    it('should compute scale from DPI', () => {
      expect(getScale(72)).toBeCloseTo(1.0);
      expect(getScale(150)).toBeCloseTo(150 / 72);
      expect(getScale(300)).toBeCloseTo(300 / 72);
    });
  });

  describe('canvasYToPdfY', () => {
    it('should convert canvas top (y=0) to PDF page top', () => {
      const pdfY = canvasYToPdfY(0, pdfPageHeight, scale);
      expect(pdfY).toBeCloseTo(pdfPageHeight);
    });

    it('should convert canvas bottom to PDF bottom (y=0)', () => {
      const canvasHeight = pdfPageHeight * scale;
      const pdfY = canvasYToPdfY(canvasHeight, pdfPageHeight, scale);
      expect(pdfY).toBeCloseTo(0);
    });

    it('should convert canvas midpoint to PDF midpoint', () => {
      const canvasMid = (pdfPageHeight * scale) / 2;
      const pdfY = canvasYToPdfY(canvasMid, pdfPageHeight, scale);
      expect(pdfY).toBeCloseTo(pdfPageHeight / 2);
    });
  });

  describe('pdfYToCanvasY', () => {
    it('should convert PDF top to canvas top (y=0)', () => {
      const canvasY = pdfYToCanvasY(pdfPageHeight, pdfPageHeight, scale);
      expect(canvasY).toBeCloseTo(0);
    });

    it('should convert PDF bottom (y=0) to canvas bottom', () => {
      const canvasY = pdfYToCanvasY(0, pdfPageHeight, scale);
      const expectedCanvasHeight = pdfPageHeight * scale;
      expect(canvasY).toBeCloseTo(expectedCanvasHeight);
    });

    it('should be the inverse of canvasYToPdfY', () => {
      const canvasY = 500;
      const pdfY = canvasYToPdfY(canvasY, pdfPageHeight, scale);
      const backToCanvas = pdfYToCanvasY(pdfY, pdfPageHeight, scale);
      expect(backToCanvas).toBeCloseTo(canvasY);
    });
  });
});
