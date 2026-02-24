import { describe, it, expect } from 'vitest';
import { detectSystemBoundaries } from '../systemDetector';

describe('detectSystemBoundaries', () => {
  it('should return empty for all-white projection', () => {
    const projection = new Array(100).fill(0);
    expect(detectSystemBoundaries(projection)).toEqual([]);
  });

  it('should return empty for empty projection', () => {
    expect(detectSystemBoundaries([])).toEqual([]);
  });

  it('should extend single system to page edges', () => {
    const projection = [
      ...new Array(20).fill(0),   // top margin
      ...new Array(60).fill(100), // content (20..80)
      ...new Array(20).fill(0),   // bottom margin
    ];
    const systems = detectSystemBoundaries(projection, 10);
    expect(systems).toHaveLength(1);
    expect(systems[0]).toEqual({ topPx: 0, bottomPx: 100 });
  });

  it('should extend first and last system to page edges for two systems', () => {
    const projection = [
      ...new Array(20).fill(0),   // top margin
      ...new Array(40).fill(100), // system 1 (content 20..60)
      ...new Array(60).fill(0),   // large gap
      ...new Array(40).fill(100), // system 2 (content 120..160)
      ...new Array(20).fill(0),   // bottom margin
    ];
    const systems = detectSystemBoundaries(projection, 50);
    expect(systems).toHaveLength(2);
    expect(systems[0]).toEqual({ topPx: 0, bottomPx: 60 });
    expect(systems[1]).toEqual({ topPx: 120, bottomPx: 180 });
  });

  it('should not split on gaps smaller than minGapHeight', () => {
    const projection = [
      ...new Array(10).fill(0),   // margin
      ...new Array(30).fill(100), // content
      ...new Array(20).fill(0),   // small gap (< 50)
      ...new Array(30).fill(100), // more content
      ...new Array(10).fill(0),   // margin
    ];
    const systems = detectSystemBoundaries(projection, 50);
    expect(systems).toHaveLength(1);
    expect(systems[0]).toEqual({ topPx: 0, bottomPx: 100 });
  });

  it('should extend single system to page edges even with large margins', () => {
    // Two large gaps with no content between them
    const projection = [
      ...new Array(60).fill(0),   // large gap 1
      ...new Array(30).fill(100), // content (60..90)
      ...new Array(60).fill(0),   // large gap 2
    ];
    const systems = detectSystemBoundaries(projection, 50);
    expect(systems).toHaveLength(1);
    expect(systems[0]).toEqual({ topPx: 0, bottomPx: 150 });
  });

  it('should keep internal boundaries tight to content for three systems', () => {
    const projection = [
      ...new Array(10).fill(0),   // top margin
      ...new Array(20).fill(100), // system 1
      ...new Array(60).fill(0),   // gap
      ...new Array(20).fill(100), // system 2 (content 90..110)
      ...new Array(60).fill(0),   // gap
      ...new Array(20).fill(100), // system 3
      ...new Array(10).fill(0),   // bottom margin
    ];
    const systems = detectSystemBoundaries(projection, 50);
    expect(systems).toHaveLength(3);
    // First system extends to page top
    expect(systems[0].topPx).toBe(0);
    // Middle system keeps content-tight boundaries
    expect(systems[1]).toEqual({ topPx: 90, bottomPx: 110 });
    // Last system extends to page bottom
    expect(systems[2].bottomPx).toBe(200);
  });
});
