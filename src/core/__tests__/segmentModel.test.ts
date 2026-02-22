import { describe, it, expect } from 'vitest';
import { derivePartsFromSegments } from '../segmentModel';
import type { Segment } from '../segmentModel';

describe('derivePartsFromSegments', () => {
  it('should return empty array for empty segments', () => {
    expect(derivePartsFromSegments([])).toEqual([]);
  });

  it('should skip segments without labels', () => {
    const segments: Segment[] = [
      { id: '1', pageIndex: 0, top: 700, bottom: 600, label: '', systemIndex: 0 },
    ];
    expect(derivePartsFromSegments(segments)).toEqual([]);
  });

  it('should group segments by label', () => {
    const segments: Segment[] = [
      { id: '1', pageIndex: 0, top: 700, bottom: 600, label: 'Violin I', systemIndex: 0 },
      { id: '2', pageIndex: 0, top: 500, bottom: 400, label: 'Cello', systemIndex: 0 },
      { id: '3', pageIndex: 1, top: 700, bottom: 600, label: 'Violin I', systemIndex: 0 },
    ];
    const parts = derivePartsFromSegments(segments);
    expect(parts).toHaveLength(2);

    const violinPart = parts.find((p) => p.label === 'Violin I');
    expect(violinPart).toBeDefined();
    expect(violinPart!.segments).toHaveLength(2);

    const celloPart = parts.find((p) => p.label === 'Cello');
    expect(celloPart).toBeDefined();
    expect(celloPart!.segments).toHaveLength(1);
  });

  it('should sort segments by page then by top (descending, i.e. top of page first)', () => {
    const segments: Segment[] = [
      { id: '1', pageIndex: 1, top: 700, bottom: 600, label: 'Violin I', systemIndex: 0 },
      { id: '2', pageIndex: 0, top: 500, bottom: 400, label: 'Violin I', systemIndex: 0 },
      { id: '3', pageIndex: 0, top: 700, bottom: 600, label: 'Violin I', systemIndex: 0 },
    ];
    const parts = derivePartsFromSegments(segments);
    const violinPart = parts[0];
    expect(violinPart.segments[0].id).toBe('3'); // page 0, top 700
    expect(violinPart.segments[1].id).toBe('2'); // page 0, top 500
    expect(violinPart.segments[2].id).toBe('1'); // page 1, top 700
  });

  it('should sort segments by page, then systemIndex, then top descending', () => {
    const segments: Segment[] = [
      { id: '1', pageIndex: 0, top: 700, bottom: 600, label: 'Violin I', systemIndex: 1 },
      { id: '2', pageIndex: 0, top: 700, bottom: 600, label: 'Violin I', systemIndex: 0 },
      { id: '3', pageIndex: 0, top: 300, bottom: 200, label: 'Violin I', systemIndex: 0 },
    ];
    const parts = derivePartsFromSegments(segments);
    const violinPart = parts[0];
    expect(violinPart.segments[0].id).toBe('2'); // page 0, system 0, top 700
    expect(violinPart.segments[1].id).toBe('3'); // page 0, system 0, top 300
    expect(violinPart.segments[2].id).toBe('1'); // page 0, system 1, top 700
  });
});
