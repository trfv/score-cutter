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

  it('should return boundaries tight to content edges for a single system', () => {
    const projection = [
      ...new Array(20).fill(0),   // top margin
      ...new Array(60).fill(100), // content (20..80)
      ...new Array(20).fill(0),   // bottom margin
    ];
    const systems = detectSystemBoundaries(projection, 10);
    expect(systems).toHaveLength(1);
    expect(systems[0]).toEqual({ topPx: 20, bottomPx: 80 });
  });

  it('should return boundaries tight to content edges for two systems', () => {
    const projection = [
      ...new Array(20).fill(0),   // top margin
      ...new Array(40).fill(100), // system 1 (20..60)
      ...new Array(60).fill(0),   // large gap
      ...new Array(40).fill(100), // system 2 (120..160)
      ...new Array(20).fill(0),   // bottom margin
    ];
    const systems = detectSystemBoundaries(projection, 50);
    expect(systems).toHaveLength(2);
    expect(systems[0]).toEqual({ topPx: 20, bottomPx: 60 });
    expect(systems[1]).toEqual({ topPx: 120, bottomPx: 160 });
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
    expect(systems[0]).toEqual({ topPx: 10, bottomPx: 90 });
  });

  it('should skip empty regions between gaps', () => {
    // Two large gaps with no content between them
    const projection = [
      ...new Array(60).fill(0),   // large gap 1
      ...new Array(30).fill(100), // content (60..90)
      ...new Array(60).fill(0),   // large gap 2
    ];
    const systems = detectSystemBoundaries(projection, 50);
    expect(systems).toHaveLength(1);
    expect(systems[0]).toEqual({ topPx: 60, bottomPx: 90 });
  });
});
