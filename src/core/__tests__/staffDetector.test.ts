import { describe, it, expect } from 'vitest';
import { detectStaffBoundaries, detectStaffsInSystem } from '../staffDetector';

describe('staffDetector', () => {
  describe('detectStaffBoundaries', () => {
    it('should return empty for all-white projection', () => {
      const projection = new Array(100).fill(0);
      const boundaries = detectStaffBoundaries(projection);
      expect(boundaries).toEqual([]);
    });

    it('should detect a single staff with content', () => {
      // Page with one band of content in the middle
      const projection = [
        ...new Array(20).fill(0),   // top margin (white)
        ...new Array(60).fill(100), // content
        ...new Array(20).fill(0),   // bottom margin (white)
      ];
      const boundaries = detectStaffBoundaries(projection, 10);
      expect(boundaries).toHaveLength(1);
      expect(boundaries[0].topPx).toBeLessThanOrEqual(20);
      expect(boundaries[0].bottomPx).toBeGreaterThanOrEqual(80);
    });

    it('should detect two staffs separated by a gap', () => {
      const projection = [
        ...new Array(10).fill(0),   // top margin
        ...new Array(30).fill(100), // staff 1
        ...new Array(20).fill(0),   // gap between staffs
        ...new Array(30).fill(100), // staff 2
        ...new Array(10).fill(0),   // bottom margin
      ];
      const boundaries = detectStaffBoundaries(projection, 15);
      expect(boundaries).toHaveLength(2);
      // First staff should be in the top portion
      expect(boundaries[0].topPx).toBeLessThan(boundaries[1].topPx);
    });

    it('should not split on small gaps', () => {
      const projection = [
        ...new Array(10).fill(0),   // top margin
        ...new Array(30).fill(100), // content
        ...new Array(5).fill(0),    // small gap (below minGapHeight)
        ...new Array(30).fill(100), // more content
        ...new Array(10).fill(0),   // bottom margin
      ];
      const boundaries = detectStaffBoundaries(projection, 10);
      expect(boundaries).toHaveLength(1);
    });

    it('should detect three staffs', () => {
      const projection = [
        ...new Array(10).fill(0),   // top margin
        ...new Array(20).fill(100), // staff 1
        ...new Array(15).fill(0),   // gap
        ...new Array(20).fill(100), // staff 2
        ...new Array(15).fill(0),   // gap
        ...new Array(20).fill(100), // staff 3
        ...new Array(10).fill(0),   // bottom margin
      ];
      const boundaries = detectStaffBoundaries(projection, 10);
      expect(boundaries).toHaveLength(3);
    });

    it('skips region when gap at start yields gapCenter equal to currentTop', () => {
      // gap at start: {start:0, end:2}, gapCenter=1, currentTop=0 → 1 > 0 true
      // But we need gapCenter === currentTop. With minGapHeight=1:
      // gap {start:0, end:1}, center=floor(0.5)=0, so 0 > 0 is false
      const projection = [0, 100, 100, 100];
      const boundaries = detectStaffBoundaries(projection, 1);
      // gap at [0,1], center=0; no second gap; last staff from 0 to end
      expect(boundaries).toHaveLength(1);
      expect(boundaries[0].topPx).toBe(0);
    });
  });

  describe('detectStaffsInSystem', () => {
    it('should detect multiple staffs within a system region', () => {
      const projection = [
        ...new Array(20).fill(0),   // top margin
        ...new Array(25).fill(100), // staff 1
        ...new Array(20).fill(0),   // gap (part-level)
        ...new Array(25).fill(100), // staff 2
        ...new Array(20).fill(0),   // gap (part-level)
        ...new Array(25).fill(100), // staff 3
        ...new Array(20).fill(0),   // bottom margin
      ];
      // System region covers 20..135 (all three staffs + gaps)
      const parts = detectStaffsInSystem(projection, 20, 135, 15);
      expect(parts).toHaveLength(3);
    });

    it('should return single boundary when no internal gaps', () => {
      const projection = [
        ...new Array(20).fill(0),   // margin
        ...new Array(60).fill(100), // uniform content
        ...new Array(20).fill(0),   // margin
      ];
      // System covers 20..80
      const parts = detectStaffsInSystem(projection, 20, 80, 100);
      expect(parts).toHaveLength(1);
      expect(parts[0].topPx).toBe(20);
      expect(parts[0].bottomPx).toBe(80);
    });

    it('should return global coordinates (offset by systemTopPx)', () => {
      const projection = [
        ...new Array(100).fill(0),  // top margin
        ...new Array(30).fill(100), // staff 1
        ...new Array(20).fill(0),   // gap
        ...new Array(30).fill(100), // staff 2
        ...new Array(100).fill(0),  // bottom margin
      ];
      // System covers 100..180
      const parts = detectStaffsInSystem(projection, 100, 180, 15);
      expect(parts).toHaveLength(2);
      // Coordinates should be global, not relative
      expect(parts[0].topPx).toBeGreaterThanOrEqual(100);
      expect(parts[1].bottomPx).toBeLessThanOrEqual(180);
    });

    it('should fallback to full system boundary when sub-projection has no content', () => {
      // System region covers all zeros — no content detected
      const projection = new Array(100).fill(0);
      const parts = detectStaffsInSystem(projection, 20, 80, 15);
      expect(parts).toHaveLength(1);
      expect(parts[0].topPx).toBe(20);
      expect(parts[0].bottomPx).toBe(80);
    });

    it('should detect staffs matching system-level boundaries', () => {
      const projection = [
        ...new Array(20).fill(0),   // top margin
        ...new Array(25).fill(100), // part 1
        ...new Array(20).fill(0),   // small gap
        ...new Array(25).fill(100), // part 2
        ...new Array(20).fill(0),   // small gap
        ...new Array(25).fill(100), // part 3
        ...new Array(20).fill(0),   // bottom margin
      ];
      // Treat whole as one system (system gap large enough)
      const systemBounds = detectStaffBoundaries(projection, 50);
      expect(systemBounds).toHaveLength(1);

      // detectStaffsInSystem should find 3 staffs within that system
      const parts = detectStaffsInSystem(
        projection, systemBounds[0].topPx, systemBounds[0].bottomPx, 15,
      );
      expect(parts).toHaveLength(3);
      // All parts should be within the system bounds
      for (const part of parts) {
        expect(part.topPx).toBeGreaterThanOrEqual(systemBounds[0].topPx);
        expect(part.bottomPx).toBeLessThanOrEqual(systemBounds[0].bottomPx);
      }
    });
  });
});
