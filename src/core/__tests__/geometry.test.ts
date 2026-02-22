import { describe, it, expect } from 'vitest';
import {
  rectsOverlap,
  rectContains,
  clampValue,
  segmentHeight,
} from '../geometry';

describe('geometry', () => {
  describe('rectsOverlap', () => {
    it('should detect overlapping rectangles', () => {
      const a = { top: 100, bottom: 50, left: 0, right: 100 };
      const b = { top: 80, bottom: 30, left: 50, right: 150 };
      expect(rectsOverlap(a, b)).toBe(true);
    });

    it('should detect non-overlapping rectangles', () => {
      const a = { top: 100, bottom: 50, left: 0, right: 100 };
      const b = { top: 40, bottom: 10, left: 0, right: 100 };
      expect(rectsOverlap(a, b)).toBe(false);
    });

    it('should detect touching rectangles as non-overlapping', () => {
      const a = { top: 100, bottom: 50, left: 0, right: 100 };
      const b = { top: 50, bottom: 10, left: 0, right: 100 };
      expect(rectsOverlap(a, b)).toBe(false);
    });
  });

  describe('rectContains', () => {
    it('should return true when outer contains inner', () => {
      const outer = { top: 100, bottom: 0, left: 0, right: 200 };
      const inner = { top: 80, bottom: 20, left: 10, right: 190 };
      expect(rectContains(outer, inner)).toBe(true);
    });

    it('should return false when inner extends beyond outer', () => {
      const outer = { top: 100, bottom: 50, left: 0, right: 100 };
      const inner = { top: 120, bottom: 60, left: 0, right: 100 };
      expect(rectContains(outer, inner)).toBe(false);
    });
  });

  describe('clampValue', () => {
    it('should clamp a value within bounds', () => {
      expect(clampValue(5, 0, 10)).toBe(5);
    });

    it('should clamp a value below minimum to minimum', () => {
      expect(clampValue(-5, 0, 10)).toBe(0);
    });

    it('should clamp a value above maximum to maximum', () => {
      expect(clampValue(15, 0, 10)).toBe(10);
    });
  });

  describe('segmentHeight', () => {
    it('should return the height of a segment (top - bottom)', () => {
      expect(segmentHeight({ top: 100, bottom: 30 })).toBe(70);
    });

    it('should return 0 for zero-height segment', () => {
      expect(segmentHeight({ top: 50, bottom: 50 })).toBe(0);
    });
  });
});
