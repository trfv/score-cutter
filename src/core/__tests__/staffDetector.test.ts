import { describe, it, expect } from 'vitest';
import { detectStaffBoundaries, detectSystems } from '../staffDetector';

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
  });

  describe('detectSystems', () => {
    it('should return empty for all-white projection', () => {
      const projection = new Array(100).fill(0);
      expect(detectSystems(projection)).toEqual([]);
    });

    it('should detect a single system with one part', () => {
      const projection = [
        ...new Array(20).fill(0),   // top margin
        ...new Array(60).fill(100), // one content band
        ...new Array(20).fill(0),   // bottom margin
      ];
      const systems = detectSystems(projection, 50, 10);
      expect(systems).toHaveLength(1);
      expect(systems[0].parts).toHaveLength(1);
    });

    it('should detect two systems each with one part', () => {
      const projection = [
        ...new Array(20).fill(0),   // top margin
        ...new Array(40).fill(100), // system 1 content
        ...new Array(60).fill(0),   // large gap between systems
        ...new Array(40).fill(100), // system 2 content
        ...new Array(20).fill(0),   // bottom margin
      ];
      const systems = detectSystems(projection, 50, 10);
      expect(systems).toHaveLength(2);
      expect(systems[0].parts).toHaveLength(1);
      expect(systems[1].parts).toHaveLength(1);
      expect(systems[0].topPx).toBeLessThan(systems[1].topPx);
    });

    it('should detect one system with three parts', () => {
      // Small gaps (20px) between parts, no large gap => one system
      const projection = [
        ...new Array(20).fill(0),   // top margin
        ...new Array(30).fill(100), // part 1
        ...new Array(20).fill(0),   // small gap between parts
        ...new Array(30).fill(100), // part 2
        ...new Array(20).fill(0),   // small gap between parts
        ...new Array(30).fill(100), // part 3
        ...new Array(20).fill(0),   // bottom margin
      ];
      const systems = detectSystems(projection, 50, 15);
      expect(systems).toHaveLength(1);
      expect(systems[0].parts).toHaveLength(3);
    });

    it('should detect two systems each with three parts', () => {
      // Two systems separated by large gap (60px),
      // each system has 3 parts separated by small gaps (20px)
      const projection = [
        ...new Array(20).fill(0),   // top margin
        // System 1
        ...new Array(25).fill(100), // part 1
        ...new Array(20).fill(0),   // small gap
        ...new Array(25).fill(100), // part 2
        ...new Array(20).fill(0),   // small gap
        ...new Array(25).fill(100), // part 3
        // System gap
        ...new Array(60).fill(0),   // large gap between systems
        // System 2
        ...new Array(25).fill(100), // part 1
        ...new Array(20).fill(0),   // small gap
        ...new Array(25).fill(100), // part 2
        ...new Array(20).fill(0),   // small gap
        ...new Array(25).fill(100), // part 3
        ...new Array(20).fill(0),   // bottom margin
      ];
      const systems = detectSystems(projection, 50, 15);
      expect(systems).toHaveLength(2);
      expect(systems[0].parts).toHaveLength(3);
      expect(systems[1].parts).toHaveLength(3);
    });

    it('should return empty for empty projection', () => {
      expect(detectSystems([])).toEqual([]);
    });

    it('should handle a single thin content band as one system with one part', () => {
      const projection = [
        ...new Array(60).fill(0),  // margin
        ...new Array(10).fill(100), // thin content
        ...new Array(60).fill(0),  // margin
      ];
      const systems = detectSystems(projection, 50, 5);
      expect(systems).toHaveLength(1);
      expect(systems[0].parts).toHaveLength(1);
    });
  });
});
