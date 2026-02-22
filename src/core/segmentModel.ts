export interface Segment {
  id: string;
  pageIndex: number;
  top: number;
  bottom: number;
  label: string;
  systemIndex: number;
}

export interface Part {
  label: string;
  segments: Segment[];
}

export interface PageDimension {
  width: number;
  height: number;
}

export function derivePartsFromSegments(segments: Segment[]): Part[] {
  const partMap = new Map<string, Segment[]>();

  for (const seg of segments) {
    if (!seg.label) continue;
    const existing = partMap.get(seg.label) ?? [];
    existing.push(seg);
    partMap.set(seg.label, existing);
  }

  const parts: Part[] = [];
  for (const [label, segs] of partMap) {
    const sorted = segs.slice().sort((a, b) => {
      if (a.pageIndex !== b.pageIndex) return a.pageIndex - b.pageIndex;
      if (a.systemIndex !== b.systemIndex) return a.systemIndex - b.systemIndex;
      return b.top - a.top;
    });
    parts.push({ label, segments: sorted });
  }

  return parts;
}
