import { describe, it, expect } from 'vitest';
import { findGaps, findContentBounds } from '../projectionAnalysis';

describe('findGaps', () => {
  it('should return empty for all-content projection', () => {
    const projection = new Array(100).fill(100);
    expect(findGaps(projection, 10, 5)).toEqual([]);
  });

  it('should find a single gap', () => {
    const projection = [
      ...new Array(30).fill(100),
      ...new Array(20).fill(0),
      ...new Array(30).fill(100),
    ];
    const gaps = findGaps(projection, 10, 5);
    expect(gaps).toHaveLength(1);
    expect(gaps[0]).toEqual({ start: 30, end: 50 });
  });

  it('should ignore gaps smaller than minGapHeight', () => {
    const projection = [
      ...new Array(30).fill(100),
      ...new Array(5).fill(0),
      ...new Array(30).fill(100),
    ];
    expect(findGaps(projection, 10, 5)).toEqual([]);
  });

  it('should detect trailing gap', () => {
    const projection = [
      ...new Array(30).fill(100),
      ...new Array(20).fill(0),
    ];
    const gaps = findGaps(projection, 10, 5);
    expect(gaps).toHaveLength(1);
    expect(gaps[0]).toEqual({ start: 30, end: 50 });
  });

  it('should not detect trailing gap shorter than minGapHeight', () => {
    const projection = [
      ...new Array(30).fill(100),
      ...new Array(5).fill(0),
    ];
    expect(findGaps(projection, 10, 5)).toEqual([]);
  });

  it('should detect multiple gaps', () => {
    const projection = [
      ...new Array(10).fill(100),
      ...new Array(15).fill(0),
      ...new Array(10).fill(100),
      ...new Array(15).fill(0),
      ...new Array(10).fill(100),
    ];
    const gaps = findGaps(projection, 10, 5);
    expect(gaps).toHaveLength(2);
  });

  it('should treat values at threshold as gap', () => {
    const projection = [
      ...new Array(10).fill(100),
      ...new Array(15).fill(5),  // exactly at threshold
      ...new Array(10).fill(100),
    ];
    const gaps = findGaps(projection, 10, 5);
    expect(gaps).toHaveLength(1);
  });
});

describe('findContentBounds', () => {
  it('should find content bounds within a region', () => {
    const projection = [
      ...new Array(10).fill(0),
      ...new Array(20).fill(100),
      ...new Array(10).fill(0),
    ];
    const bounds = findContentBounds(projection, 0, 40, 5);
    expect(bounds).toEqual({ topPx: 10, bottomPx: 30 });
  });

  it('should return null for empty region', () => {
    const projection = new Array(40).fill(0);
    expect(findContentBounds(projection, 0, 40, 5)).toBeNull();
  });

  it('should respect start and end boundaries', () => {
    const projection = [
      ...new Array(5).fill(100),
      ...new Array(10).fill(0),
      ...new Array(5).fill(100),
      ...new Array(10).fill(0),
      ...new Array(5).fill(100),
    ];
    // Only look at range [10, 25] which has content at [15, 20)
    const bounds = findContentBounds(projection, 10, 25, 5);
    expect(bounds).toEqual({ topPx: 15, bottomPx: 20 });
  });

  it('should return single-row content bounds', () => {
    const projection = new Array(20).fill(0);
    projection[10] = 100;
    const bounds = findContentBounds(projection, 0, 20, 5);
    expect(bounds).toEqual({ topPx: 10, bottomPx: 11 });
  });
});
