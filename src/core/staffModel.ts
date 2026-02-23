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

export function applySystemLabelsToAll(
  staffs: Staff[],
  templatePageIndex: number,
  templateSystemIndex: number,
): Staff[] {
  const templateStaffs = staffs
    .filter((s) => s.pageIndex === templatePageIndex && s.systemIndex === templateSystemIndex)
    .sort((a, b) => b.top - a.top);

  if (templateStaffs.length === 0) return staffs;

  const systemKey = (s: Staff) => `${s.pageIndex}-${s.systemIndex}`;
  const templateKey = `${templatePageIndex}-${templateSystemIndex}`;

  // Pre-group and sort each system for O(1) lookup
  const grouped = new Map<string, Staff[]>();
  for (const s of staffs) {
    const key = systemKey(s);
    const group = grouped.get(key) ?? [];
    group.push(s);
    grouped.set(key, group);
  }
  for (const group of grouped.values()) {
    group.sort((a, b) => b.top - a.top);
  }

  return staffs.map((staff) => {
    const key = systemKey(staff);
    if (key === templateKey) return staff;

    const group = grouped.get(key)!;
    const idx = group.indexOf(staff);
    if (idx >= 0 && idx < templateStaffs.length) {
      return { ...staff, label: templateStaffs[idx].label };
    }
    return staff;
  });
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
