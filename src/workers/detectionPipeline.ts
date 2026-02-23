import { toGrayscale, toBinary, horizontalProjection } from '../core/imageProcessing';
import { detectSystemBoundaries } from '../core/systemDetector';
import type { SystemBoundaryPx } from '../core/systemDetector';
import { detectStaffsInSystem } from '../core/staffDetector';
import type { StaffBoundary } from '../core/staffDetector';

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

interface StaffDetectionInput {
  rgbaData: Uint8ClampedArray;
  width: number;
  height: number;
  systemBoundaries: SystemBoundaryPx[];
  partGapHeight: number;
}

interface StaffDetectionResult {
  staffsBySystem: StaffBoundary[][];
}

export function runStaffDetection(input: StaffDetectionInput): StaffDetectionResult {
  const imageData = {
    data: input.rgbaData,
    width: input.width,
    height: input.height,
    colorSpace: 'srgb' as const,
  } as ImageData;

  const gray = toGrayscale(imageData);
  const binary = toBinary(gray);
  const projection = horizontalProjection(binary, input.width, input.height);

  const staffsBySystem: StaffBoundary[][] = input.systemBoundaries.map((sys) =>
    detectStaffsInSystem(projection, sys.topPx, sys.bottomPx, input.partGapHeight),
  );

  return { staffsBySystem };
}
