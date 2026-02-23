import { describe, it, expect } from 'vitest';
import { runSystemDetection, runStaffDetection } from '../detectionPipeline';

function createRgbaRow(width: number, isBlack: boolean): number[] {
  const pixel = isBlack ? [0, 0, 0, 255] : [255, 255, 255, 255];
  return Array.from({ length: width }, () => pixel).flat();
}

describe('runSystemDetection', () => {
  it('should detect systems from raw RGBA data', () => {
    const width = 100;
    const rows = [
      ...Array.from({ length: 20 }, () => createRgbaRow(width, false)),  // white margin
      ...Array.from({ length: 40 }, () => createRgbaRow(width, true)),   // content
      ...Array.from({ length: 60 }, () => createRgbaRow(width, false)),  // large gap
      ...Array.from({ length: 40 }, () => createRgbaRow(width, true)),   // content
      ...Array.from({ length: 20 }, () => createRgbaRow(width, false)),  // white margin
    ];
    const rgbaData = new Uint8ClampedArray(rows.flat());
    const result = runSystemDetection({
      rgbaData,
      width,
      height: 180,
      systemGapHeight: 50,
    });
    expect(result.systems).toHaveLength(2);
    // Systems are simple boundaries (no nested parts)
    expect(result.systems[0]).toHaveProperty('topPx');
    expect(result.systems[0]).toHaveProperty('bottomPx');
    expect(result.systems[0]).not.toHaveProperty('parts');
  });

  it('should return empty systems for all-white image', () => {
    const width = 50;
    const height = 100;
    const rgbaData = new Uint8ClampedArray(width * height * 4).fill(255);
    const result = runSystemDetection({
      rgbaData,
      width,
      height,
      systemGapHeight: 50,
    });
    expect(result.systems).toHaveLength(0);
  });

  it('should detect single system with one part', () => {
    const width = 50;
    const rows = [
      ...Array.from({ length: 30 }, () => createRgbaRow(width, false)),
      ...Array.from({ length: 40 }, () => createRgbaRow(width, true)),
      ...Array.from({ length: 30 }, () => createRgbaRow(width, false)),
    ];
    const rgbaData = new Uint8ClampedArray(rows.flat());
    const result = runSystemDetection({
      rgbaData,
      width,
      height: 100,
      systemGapHeight: 20,
    });
    expect(result.systems).toHaveLength(1);
  });
});

describe('runStaffDetection', () => {
  it('should detect staffs within each system boundary', () => {
    const width = 100;
    // Two systems, each with 2 staffs (separated by small 20px gaps)
    const rows = [
      ...Array.from({ length: 20 }, () => createRgbaRow(width, false)),  // top margin
      // System 1 (rows 20-109)
      ...Array.from({ length: 25 }, () => createRgbaRow(width, true)),   // staff 1
      ...Array.from({ length: 20 }, () => createRgbaRow(width, false)),  // gap
      ...Array.from({ length: 25 }, () => createRgbaRow(width, true)),   // staff 2
      ...Array.from({ length: 20 }, () => createRgbaRow(width, false)),  // margin within
      // System gap (rows 110-169)
      ...Array.from({ length: 60 }, () => createRgbaRow(width, false)),  // large gap
      // System 2 (rows 170-259)
      ...Array.from({ length: 25 }, () => createRgbaRow(width, true)),   // staff 1
      ...Array.from({ length: 20 }, () => createRgbaRow(width, false)),  // gap
      ...Array.from({ length: 25 }, () => createRgbaRow(width, true)),   // staff 2
      ...Array.from({ length: 20 }, () => createRgbaRow(width, false)),  // bottom margin
    ];
    const height = rows.length;
    const rgbaData = new Uint8ClampedArray(rows.flat());

    // First detect systems
    const systemResult = runSystemDetection({ rgbaData, width, height, systemGapHeight: 50 });
    expect(systemResult.systems).toHaveLength(2);

    // Then detect staffs
    const staffResult = runStaffDetection({
      rgbaData,
      width,
      height,
      systemBoundaries: systemResult.systems,
      partGapHeight: 15,
    });

    expect(staffResult.staffsBySystem).toHaveLength(2);
    expect(staffResult.staffsBySystem[0]).toHaveLength(2);
    expect(staffResult.staffsBySystem[1]).toHaveLength(2);
  });

  it('should return one staff per system when no internal gaps', () => {
    const width = 50;
    const rows = [
      ...Array.from({ length: 20 }, () => createRgbaRow(width, false)),
      ...Array.from({ length: 40 }, () => createRgbaRow(width, true)),
      ...Array.from({ length: 20 }, () => createRgbaRow(width, false)),
    ];
    const rgbaData = new Uint8ClampedArray(rows.flat());

    const staffResult = runStaffDetection({
      rgbaData,
      width,
      height: 80,
      systemBoundaries: [{ topPx: 20, bottomPx: 60 }],
      partGapHeight: 15,
    });

    expect(staffResult.staffsBySystem).toHaveLength(1);
    expect(staffResult.staffsBySystem[0]).toHaveLength(1);
  });

  it('should handle empty system boundaries', () => {
    const width = 50;
    const rgbaData = new Uint8ClampedArray(width * 100 * 4).fill(255);

    const staffResult = runStaffDetection({
      rgbaData,
      width,
      height: 100,
      systemBoundaries: [],
      partGapHeight: 15,
    });

    expect(staffResult.staffsBySystem).toHaveLength(0);
  });
});
