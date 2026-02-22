import { describe, it, expect } from 'vitest';
import {
  toGrayscale,
  toBinary,
  horizontalProjection,
} from '../imageProcessing';

function createImageData(
  width: number,
  height: number,
  pixels: number[],
): ImageData {
  const data = new Uint8ClampedArray(pixels);
  return { data, width, height, colorSpace: 'srgb' } as ImageData;
}

describe('imageProcessing', () => {
  describe('toGrayscale', () => {
    it('should convert white pixel to 255', () => {
      const imageData = createImageData(1, 1, [255, 255, 255, 255]);
      const gray = toGrayscale(imageData);
      expect(gray[0]).toBe(255);
    });

    it('should convert black pixel to 0', () => {
      const imageData = createImageData(1, 1, [0, 0, 0, 255]);
      const gray = toGrayscale(imageData);
      expect(gray[0]).toBe(0);
    });

    it('should weight RGB channels correctly', () => {
      const imageData = createImageData(1, 1, [100, 150, 200, 255]);
      const gray = toGrayscale(imageData);
      const expected = Math.round(0.299 * 100 + 0.587 * 150 + 0.114 * 200);
      expect(gray[0]).toBe(expected);
    });

    it('should handle multiple pixels', () => {
      const imageData = createImageData(2, 1, [
        0, 0, 0, 255,
        255, 255, 255, 255,
      ]);
      const gray = toGrayscale(imageData);
      expect(gray).toHaveLength(2);
      expect(gray[0]).toBe(0);
      expect(gray[1]).toBe(255);
    });
  });

  describe('toBinary', () => {
    it('should mark dark pixels as 1', () => {
      const grayscale = new Uint8Array([50, 200, 0, 127, 128, 255]);
      const binary = toBinary(grayscale, 128);
      expect(Array.from(binary)).toEqual([1, 0, 1, 1, 0, 0]);
    });
  });

  describe('horizontalProjection', () => {
    it('should count black pixels per row', () => {
      // 3x2 image:
      // row 0: [1, 0, 1] -> sum = 2
      // row 1: [0, 0, 0] -> sum = 0
      const binary = new Uint8Array([1, 0, 1, 0, 0, 0]);
      const projection = horizontalProjection(binary, 3, 2);
      expect(projection).toEqual([2, 0]);
    });

    it('should handle all-black image', () => {
      const binary = new Uint8Array([1, 1, 1, 1]);
      const projection = horizontalProjection(binary, 2, 2);
      expect(projection).toEqual([2, 2]);
    });

    it('should handle all-white image', () => {
      const binary = new Uint8Array([0, 0, 0, 0]);
      const projection = horizontalProjection(binary, 2, 2);
      expect(projection).toEqual([0, 0]);
    });
  });
});
