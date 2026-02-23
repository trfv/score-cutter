import { describe, it, expect } from 'vitest';
import { runSystemDetection } from '../detectionPipeline';

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
