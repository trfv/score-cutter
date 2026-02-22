interface Rect {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export function rectsOverlap(a: Rect, b: Rect): boolean {
  if (a.bottom >= b.top || b.bottom >= a.top) return false;
  if (a.right <= b.left || b.right <= a.left) return false;
  return true;
}

export function rectContains(outer: Rect, inner: Rect): boolean {
  return (
    inner.top <= outer.top &&
    inner.bottom >= outer.bottom &&
    inner.left >= outer.left &&
    inner.right <= outer.right
  );
}

export function clampValue(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function segmentHeight(segment: { top: number; bottom: number }): number {
  return segment.top - segment.bottom;
}
