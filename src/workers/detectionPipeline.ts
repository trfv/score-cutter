import { toGrayscale, toBinary, horizontalProjection } from '../core/imageProcessing';
import { detectSystemBoundaries } from '../core/systemDetector';
import type { SystemBoundaryPx } from '../core/systemDetector';

interface SystemDetectionInput {
  rgbaData: Uint8ClampedArray;
  width: number;
  height: number;
  systemGapHeight: number;
}

interface SystemDetectionResult {
  systems: SystemBoundaryPx[];
}

export function runSystemDetection(input: SystemDetectionInput): SystemDetectionResult {
  const imageData = {
    data: input.rgbaData,
    width: input.width,
    height: input.height,
    colorSpace: 'srgb' as const,
  } as ImageData;

  const gray = toGrayscale(imageData);
  const binary = toBinary(gray);
  const projection = horizontalProjection(binary, input.width, input.height);
  const systems = detectSystemBoundaries(projection, input.systemGapHeight);

  return { systems };
}
