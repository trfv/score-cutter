import { toGrayscale, toBinary, horizontalProjection } from '../core/imageProcessing';
import { detectSystems } from '../core/staffDetector';
import type { SystemBoundary } from '../core/staffDetector';

interface DetectionInput {
  rgbaData: Uint8ClampedArray;
  width: number;
  height: number;
  systemGapHeight: number;
  partGapHeight: number;
}

interface DetectionResult {
  systems: SystemBoundary[];
}

export function runDetectionPipeline(input: DetectionInput): DetectionResult {
  const imageData = {
    data: input.rgbaData,
    width: input.width,
    height: input.height,
    colorSpace: 'srgb' as const,
  } as ImageData;

  const gray = toGrayscale(imageData);
  const binary = toBinary(gray);
  const projection = horizontalProjection(binary, input.width, input.height);
  const systems = detectSystems(projection, input.systemGapHeight, input.partGapHeight);

  return { systems };
}
