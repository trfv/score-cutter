export interface SegmentBoundary {
  topPx: number;
  bottomPx: number;
}

interface Gap {
  start: number;
  end: number;
}

function findGaps(
  projection: number[],
  minGapHeight: number,
  absoluteThreshold: number,
): Gap[] {
  const gaps: Gap[] = [];
  let inGap = false;
  let gapStart = 0;

  for (let y = 0; y < projection.length; y++) {
    if (projection[y] <= absoluteThreshold) {
      if (!inGap) {
        inGap = true;
        gapStart = y;
      }
    } else {
      if (inGap) {
        inGap = false;
        if (y - gapStart >= minGapHeight) {
          gaps.push({ start: gapStart, end: y });
        }
      }
    }
  }
  if (inGap && projection.length - gapStart >= minGapHeight) {
    gaps.push({ start: gapStart, end: projection.length });
  }

  return gaps;
}

export function detectSegmentBoundaries(
  projection: number[],
  minGapHeight: number = 20,
  lowThresholdFraction: number = 0.05,
): SegmentBoundary[] {
  if (projection.length === 0) return [];

  const maxProjection = Math.max(...projection);
  if (maxProjection === 0) return [];

  const absoluteThreshold = maxProjection * lowThresholdFraction;

  const gaps = findGaps(projection, minGapHeight, absoluteThreshold);

  // Derive segments from gaps
  const segments: SegmentBoundary[] = [];
  let currentTop = 0;

  for (const gap of gaps) {
    const gapCenter = Math.floor((gap.start + gap.end) / 2);
    if (gapCenter > currentTop) {
      // Check if there is actual content in this region
      const hasContent = projection
        .slice(currentTop, gapCenter)
        .some((v) => v > absoluteThreshold);
      if (hasContent) {
        segments.push({ topPx: currentTop, bottomPx: gapCenter });
      }
    }
    currentTop = gapCenter;
  }

  // Last segment to bottom of page
  if (currentTop < projection.length) {
    const hasContent = projection
      .slice(currentTop, projection.length)
      .some((v) => v > absoluteThreshold);
    if (hasContent) {
      segments.push({ topPx: currentTop, bottomPx: projection.length });
    }
  }

  return segments;
}

export interface SystemBoundary {
  topPx: number;
  bottomPx: number;
  parts: SegmentBoundary[];
}

export function detectSystems(
  projection: number[],
  minSystemGapHeight: number = 50,
  minPartGapHeight: number = 15,
  lowThresholdFraction: number = 0.05,
): SystemBoundary[] {
  const systemBoundaries = detectSegmentBoundaries(
    projection,
    minSystemGapHeight,
    lowThresholdFraction,
  );

  return systemBoundaries.map((sys) => {
    const subProjection = projection.slice(sys.topPx, sys.bottomPx);
    const rawParts = detectSegmentBoundaries(
      subProjection,
      minPartGapHeight,
      lowThresholdFraction,
    );

    const parts: SegmentBoundary[] = rawParts.map((part) => ({
      topPx: part.topPx + sys.topPx,
      bottomPx: part.bottomPx + sys.topPx,
    }));

    if (parts.length === 0) {
      parts.push({ topPx: sys.topPx, bottomPx: sys.bottomPx });
    }

    return {
      topPx: sys.topPx,
      bottomPx: sys.bottomPx,
      parts,
    };
  });
}
