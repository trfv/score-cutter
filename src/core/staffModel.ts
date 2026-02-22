export interface Staff {
  id: string;
  pageIndex: number;
  top: number;
  bottom: number;
  label: string;
  systemIndex: number;
}

export interface Part {
  label: string;
  staffs: Staff[];
}

export interface PageDimension {
  width: number;
  height: number;
}

export function derivePartsFromStaffs(staffs: Staff[]): Part[] {
  const partMap = new Map<string, Staff[]>();

  for (const staff of staffs) {
    if (!staff.label) continue;
    const existing = partMap.get(staff.label) ?? [];
    existing.push(staff);
    partMap.set(staff.label, existing);
  }

  const parts: Part[] = [];
  for (const [label, staffs] of partMap) {
    const sorted = staffs.slice().sort((a, b) => {
      if (a.pageIndex !== b.pageIndex) return a.pageIndex - b.pageIndex;
      if (a.systemIndex !== b.systemIndex) return a.systemIndex - b.systemIndex;
      return b.top - a.top;
    });
    parts.push({ label, staffs: sorted });
  }

  return parts;
}
