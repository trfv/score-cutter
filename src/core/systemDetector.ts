import { findGaps, findContentBounds } from './projectionAnalysis';

export interface SystemBoundaryPx {
  topPx: number;
  bottomPx: number;
}

export function detectSystemBoundaries(
  projection: number[],
  minGapHeight: number = 50,
  lowThresholdFraction: number = 0.05,
): SystemBoundaryPx[] {
  if (projection.length === 0) return [];

  const maxProjection = Math.max(...projection);
  if (maxProjection === 0) return [];

  const absoluteThreshold = maxProjection * lowThresholdFraction;
  const gaps = findGaps(projection, minGapHeight, absoluteThreshold);

  const systems: SystemBoundaryPx[] = [];
  let searchStart = 0;

  for (const gap of gaps) {
    const region = findContentBounds(projection, searchStart, gap.start, absoluteThreshold);
    if (region) systems.push(region);
    searchStart = gap.end;
  }

  const lastRegion = findContentBounds(projection, searchStart, projection.length, absoluteThreshold);
  if (lastRegion) systems.push(lastRegion);

  systems[0] = { ...systems[0], topPx: 0 };
  systems[systems.length - 1] = { ...systems[systems.length - 1], bottomPx: projection.length };

  return systems;
}
