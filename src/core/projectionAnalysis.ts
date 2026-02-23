interface Gap {
  start: number;
  end: number;
}

export function findGaps(
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

export function findContentBounds(
  projection: number[],
  start: number,
  end: number,
  threshold: number,
): { topPx: number; bottomPx: number } | null {
  let first = -1;
  let last = -1;
  for (let y = start; y < end; y++) {
    if (projection[y] > threshold) {
      if (first === -1) first = y;
      last = y;
    }
  }
  if (first === -1) return null;
  return { topPx: first, bottomPx: last + 1 };
}
