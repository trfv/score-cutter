import { findGaps, findContentBounds } from './projectionAnalysis';

export interface StaffBoundary {
  topPx: number;
  bottomPx: number;
}

export function detectStaffBoundaries(
  projection: number[],
  minGapHeight: number = 20,
  lowThresholdFraction: number = 0.05,
): StaffBoundary[] {
  if (projection.length === 0) return [];

  const maxProjection = Math.max(...projection);
  if (maxProjection === 0) return [];

  const absoluteThreshold = maxProjection * lowThresholdFraction;

  const gaps = findGaps(projection, minGapHeight, absoluteThreshold);

  // Derive staffs from gaps
  const staffs: StaffBoundary[] = [];
  let currentTop = 0;

  for (const gap of gaps) {
    const gapCenter = Math.floor((gap.start + gap.end) / 2);
    if (gapCenter > currentTop) {
      // Check if there is actual content in this region
      const hasContent = projection
        .slice(currentTop, gapCenter)
        .some((v) => v > absoluteThreshold);
      if (hasContent) {
        staffs.push({ topPx: currentTop, bottomPx: gapCenter });
      }
    }
    currentTop = gapCenter;
  }

  // Last staff to bottom of page
  /* v8 ignore start -- currentTop is always < projection.length for non-empty projections with ordered gaps */
  if (currentTop < projection.length) {
  /* v8 ignore stop */
    const hasContent = projection
      .slice(currentTop, projection.length)
      .some((v) => v > absoluteThreshold);
    if (hasContent) {
      staffs.push({ topPx: currentTop, bottomPx: projection.length });
    }
  }

  return staffs;
}

export function detectSystemBoundaries(
  projection: number[],
  minGapHeight: number = 50,
  lowThresholdFraction: number = 0.05,
): StaffBoundary[] {
  if (projection.length === 0) return [];

  const maxProjection = Math.max(...projection);
  if (maxProjection === 0) return [];

  const absoluteThreshold = maxProjection * lowThresholdFraction;
  const gaps = findGaps(projection, minGapHeight, absoluteThreshold);

  const systems: StaffBoundary[] = [];
  let searchStart = 0;

  for (const gap of gaps) {
    const region = findContentBounds(projection, searchStart, gap.start, absoluteThreshold);
    if (region) systems.push(region);
    searchStart = gap.end;
  }

  const lastRegion = findContentBounds(projection, searchStart, projection.length, absoluteThreshold);
  if (lastRegion) systems.push(lastRegion);

  return systems;
}

interface SystemBoundary {
  topPx: number;
  bottomPx: number;
  parts: StaffBoundary[];
}

export function detectStaffsInSystem(
  projection: number[],
  systemTopPx: number,
  systemBottomPx: number,
  minPartGapHeight: number = 15,
  lowThresholdFraction: number = 0.05,
): StaffBoundary[] {
  const subProjection = projection.slice(systemTopPx, systemBottomPx);
  const rawParts = detectStaffBoundaries(subProjection, minPartGapHeight, lowThresholdFraction);
  const parts: StaffBoundary[] = rawParts.map((part) => ({
    topPx: part.topPx + systemTopPx,
    bottomPx: part.bottomPx + systemTopPx,
  }));
  if (parts.length === 0) {
    parts.push({ topPx: systemTopPx, bottomPx: systemBottomPx });
  }
  return parts;
}

export function detectSystems(
  projection: number[],
  minSystemGapHeight: number = 50,
  minPartGapHeight: number = 15,
  lowThresholdFraction: number = 0.05,
): SystemBoundary[] {
  const systemBoundaries = detectStaffBoundaries(
    projection,
    minSystemGapHeight,
    lowThresholdFraction,
  );

  return systemBoundaries.map((sys) => {
    const subProjection = projection.slice(sys.topPx, sys.bottomPx);
    const rawParts = detectStaffBoundaries(
      subProjection,
      minPartGapHeight,
      lowThresholdFraction,
    );

    const parts: StaffBoundary[] = rawParts.map((part) => ({
      topPx: part.topPx + sys.topPx,
      bottomPx: part.bottomPx + sys.topPx,
    }));

    /* v8 ignore start -- defensive fallback: detectStaffBoundaries always finds ≥1 staff in a system sub-projection */
    if (parts.length === 0) {
      parts.push({ topPx: sys.topPx, bottomPx: sys.bottomPx });
    }
    /* v8 ignore stop */

    return {
      topPx: sys.topPx,
      bottomPx: sys.bottomPx,
      parts,
    };
  });
}
