import { getPageSystems } from './staffModel';
import type { Staff, System } from './staffModel';
import { pdfYToCanvasY, canvasYToPdfY } from './coordinateMapper';

export type SeparatorKind = 'edge' | 'part';

export interface Separator {
  kind: SeparatorKind;
  canvasY: number;
  staffAboveId: string | null;
  staffBelowId: string | null;
}

export interface StaffRegion {
  staffId: string;
  topCanvasY: number;
  bottomCanvasY: number;
  label: string;
  systemId: string;
}

export interface SystemGroup {
  ordinal: number;
  systemId: string;
  topCanvasY: number;
  bottomCanvasY: number;
  separators: Separator[];
  regions: StaffRegion[];
}

/**
 * Sort staffs by visual position (top to bottom on screen).
 * In PDF coords, higher top = higher on page = appears first visually.
 */
function sortByVisualPosition(staffs: Staff[], pdfPageHeight: number, scale: number): Staff[] {
  return [...staffs].sort(
    (a, b) => pdfYToCanvasY(a.top, pdfPageHeight, scale) - pdfYToCanvasY(b.top, pdfPageHeight, scale),
  );
}

/**
 * Build separators and regions for a group of staffs within a single system.
 */
function buildGroupDetail(
  groupStaffs: Staff[],
  pdfPageHeight: number,
  scale: number,
): { separators: Separator[]; regions: StaffRegion[] } {
  if (groupStaffs.length === 0) return { separators: [], regions: [] };

  const separators: Separator[] = [];
  const regions: StaffRegion[] = [];

  // Top edge
  separators.push({
    kind: 'edge',
    canvasY: pdfYToCanvasY(groupStaffs[0].top, pdfPageHeight, scale),
    staffAboveId: null,
    staffBelowId: groupStaffs[0].id,
  });

  for (let i = 0; i < groupStaffs.length; i++) {
    const staff = groupStaffs[i];

    regions.push({
      staffId: staff.id,
      topCanvasY: pdfYToCanvasY(staff.top, pdfPageHeight, scale),
      bottomCanvasY: pdfYToCanvasY(staff.bottom, pdfPageHeight, scale),
      label: staff.label,
      systemId: staff.systemId,
    });

    if (i < groupStaffs.length - 1) {
      const next = groupStaffs[i + 1];
      const bottomY = pdfYToCanvasY(staff.bottom, pdfPageHeight, scale);
      const topY = pdfYToCanvasY(next.top, pdfPageHeight, scale);
      separators.push({
        kind: 'part',
        canvasY: (bottomY + topY) / 2,
        staffAboveId: staff.id,
        staffBelowId: next.id,
      });
    }
  }

  // Bottom edge
  const last = groupStaffs[groupStaffs.length - 1];
  separators.push({
    kind: 'edge',
    canvasY: pdfYToCanvasY(last.bottom, pdfPageHeight, scale),
    staffAboveId: last.id,
    staffBelowId: null,
  });

  return { separators, regions };
}

/**
 * Group staffs by system and compute separators/regions per group.
 *
 * When pageSystems is provided, groups staffs by systemId and uses System
 * boundaries for group bounds. Empty Systems (no staffs) are included.
 *
 * When pageSystems is omitted, falls back to grouping by systemId
 * (legacy behavior).
 */
export function computeSystemGroups(
  pageStaffs: Staff[],
  pdfPageHeight: number,
  scale: number,
  pageSystems?: System[],
): SystemGroup[] {
  if (pageSystems && pageSystems.length > 0) {
    return computeSystemGroupsFromSystems(pageStaffs, pageSystems, pdfPageHeight, scale);
  }
  return computeSystemGroupsLegacy(pageStaffs, pdfPageHeight, scale);
}

function computeSystemGroupsFromSystems(
  pageStaffs: Staff[],
  pageSystems: System[],
  pdfPageHeight: number,
  scale: number,
): SystemGroup[] {
  // Sort systems by top descending (visual top-to-bottom)
  const sorted = [...pageSystems].sort((a, b) => b.top - a.top);

  // Group staffs by systemId
  const staffBySystemId = new Map<string, Staff[]>();
  for (const staff of pageStaffs) {
    const group = staffBySystemId.get(staff.systemId) ?? [];
    group.push(staff);
    staffBySystemId.set(staff.systemId, group);
  }

  return sorted.map((sys, ordinal) => {
    const groupStaffs = sortByVisualPosition(
      staffBySystemId.get(sys.id) ?? [], pdfPageHeight, scale,
    );
    const { separators, regions } = buildGroupDetail(groupStaffs, pdfPageHeight, scale);

    return {
      ordinal,
      systemId: sys.id,
      topCanvasY: pdfYToCanvasY(sys.top, pdfPageHeight, scale),
      bottomCanvasY: pdfYToCanvasY(sys.bottom, pdfPageHeight, scale),
      separators,
      regions,
    };
  });
}

function computeSystemGroupsLegacy(
  pageStaffs: Staff[],
  pdfPageHeight: number,
  scale: number,
): SystemGroup[] {
  if (pageStaffs.length === 0) return [];

  // Group by systemId
  const groupMap = new Map<string, Staff[]>();
  for (const staff of pageStaffs) {
    const group = groupMap.get(staff.systemId) ?? [];
    group.push(staff);
    groupMap.set(staff.systemId, group);
  }

  // Sort groups by top position (highest top first = visual top to bottom)
  const sortedEntries = [...groupMap.entries()].sort(([, a], [, b]) => {
    const aTop = Math.max(...a.map(s => s.top));
    const bTop = Math.max(...b.map(s => s.top));
    return bTop - aTop;
  });

  return sortedEntries.map(([systemId, staffGroup], ordinal) => {
    const groupStaffs = sortByVisualPosition(staffGroup, pdfPageHeight, scale);
    const { separators, regions } = buildGroupDetail(groupStaffs, pdfPageHeight, scale);
    const first = groupStaffs[0];
    const last = groupStaffs[groupStaffs.length - 1];

    return {
      ordinal,
      systemId,
      topCanvasY: pdfYToCanvasY(first.top, pdfPageHeight, scale),
      bottomCanvasY: pdfYToCanvasY(last.bottom, pdfPageHeight, scale),
      separators,
      regions,
    };
  });
}

/**
 * Flat separator/region computation for backward compatibility.
 * Delegates to computeSystemGroups and flattens the results.
 */
export function computeSeparators(
  pageStaffs: Staff[],
  pdfPageHeight: number,
  scale: number,
): { separators: Separator[]; regions: StaffRegion[] } {
  const groups = computeSystemGroups(pageStaffs, pdfPageHeight, scale);
  return {
    separators: groups.flatMap(g => g.separators),
    regions: groups.flatMap(g => g.regions),
  };
}

/**
 * Split a system at the gap between two adjacent staffs.
 * staffAbove and staffBelow must be in the same system.
 * staffBelow and all staffs below it in the same original system are assigned to a new System.
 * Returns updated staffs and systems.
 */
export function splitSystemAtGap(
  staffs: Staff[],
  staffAboveId: string,
  staffBelowId: string,
  systems?: System[],
): { staffs: Staff[]; systems: System[] } {
  const above = staffs.find(s => s.id === staffAboveId);
  const below = staffs.find(s => s.id === staffBelowId);
  if (!above || !below) return { staffs, systems: systems ?? [] };

  const pageIndex = above.pageIndex;

  if (above.systemId !== below.systemId) return { staffs, systems: systems ?? [] };

  const sourceSystem = systems?.find(sys => sys.id === above.systemId);
  if (!sourceSystem) return { staffs, systems: systems ?? [] };

  const splitPdfY = (above.bottom + below.top) / 2;
  const updatedSource: System = { ...sourceSystem, bottom: splitPdfY };
  const newSystem: System = {
    id: crypto.randomUUID(),
    pageIndex,
    top: splitPdfY,
    bottom: sourceSystem.bottom,
  };

  /* v8 ignore start -- systems is always defined here (early return at line 229 catches undefined case) */
  const updatedSystems = [
    ...(systems ?? []).map(sys => sys.id === sourceSystem.id ? updatedSource : sys),
    newSystem,
  ];
  /* v8 ignore stop */

  const belowTop = below.top;
  const updatedStaffs = staffs.map(s => {
    if (s.pageIndex !== pageIndex) return s;
    if (s.systemId === sourceSystem.id && s.top <= belowTop) {
      return { ...s, systemId: newSystem.id };
    }
    return s;
  });

  return { staffs: updatedStaffs, systems: updatedSystems };
}

/**
 * Merge two adjacent systems on a page.
 * All staffs in system upperSystemIndex + 1 get set to upperSystemIndex.
 * Subsequent systems get decremented.
 */
export function mergeAdjacentSystems(
  staffs: Staff[],
  pageIndex: number,
  upperSystemIndex: number,
  systems?: System[],
): { staffs: Staff[]; systems: System[] } {
  const pageSystems = getPageSystems(systems ?? [], pageIndex);
  if (upperSystemIndex < 0 || upperSystemIndex >= pageSystems.length - 1) {
    return { staffs, systems: systems ?? [] };
  }
  const upperSystem = pageSystems[upperSystemIndex];
  const lowerSystem = pageSystems[upperSystemIndex + 1];

  const mergedSystem: System = { ...upperSystem, bottom: lowerSystem.bottom };
  /* v8 ignore start -- systems is always defined here (early return at line 271 catches undefined case) */
  const updatedSystems = (systems ?? [])
    .map(sys => sys.id === upperSystem.id ? mergedSystem : sys)
    .filter(sys => sys.id !== lowerSystem.id);
  /* v8 ignore stop */

  const updatedStaffs = staffs.map(s => {
    if (s.systemId === lowerSystem.id) {
      return { ...s, systemId: upperSystem.id };
    }
    return s;
  });

  return { staffs: updatedStaffs, systems: updatedSystems };
}

/**
 * Reassign staffs between two adjacent systems based on a dragged separator position.
 * systemSepIndex is the index into the list of system boundaries (gaps between systems).
 * Staffs whose center (in canvas Y) is above newCanvasY stay in the upper system;
 * those below move to the lower system.
 */
export function reassignStaffsByDrag(
  staffs: Staff[],
  pageIndex: number,
  systemSepIndex: number,
  newCanvasY: number,
  pdfPageHeight: number,
  scale: number,
  systems?: System[],
): { staffs: Staff[]; systems: System[] } {
  const pageSystems = getPageSystems(systems ?? [], pageIndex);
  if (systemSepIndex < 0 || systemSepIndex >= pageSystems.length - 1) {
    return { staffs, systems: systems ?? [] };
  }
  const upperSystem = pageSystems[systemSepIndex];
  const lowerSystem = pageSystems[systemSepIndex + 1];

  const updatedStaffs = staffs.map(s => {
    if (s.pageIndex !== pageIndex) return s;
    if (s.systemId !== upperSystem.id && s.systemId !== lowerSystem.id) return s;

    const centerCanvasY = (
      pdfYToCanvasY(s.top, pdfPageHeight, scale) +
      pdfYToCanvasY(s.bottom, pdfPageHeight, scale)
    ) / 2;

    if (centerCanvasY < newCanvasY) {
      return s.systemId !== upperSystem.id ? { ...s, systemId: upperSystem.id } : s;
    } else {
      return s.systemId !== lowerSystem.id ? { ...s, systemId: lowerSystem.id } : s;
    }
  });

  // Update system boundaries to the drag position
  const newPdfBoundary = canvasYToPdfY(newCanvasY, pdfPageHeight, scale);
  /* v8 ignore start -- systems is always defined here (early return at line 307 catches undefined case) */
  const updatedSystems = (systems ?? []).map(sys => {
  /* v8 ignore stop */
    if (sys.id === upperSystem.id) return { ...sys, bottom: newPdfBoundary };
    if (sys.id === lowerSystem.id) return { ...sys, top: newPdfBoundary };
    return sys;
  });

  return { staffs: updatedStaffs, systems: updatedSystems };
}

export function applySeparatorDrag(
  staffs: Staff[],
  separatorIndex: number,
  newCanvasY: number,
  pageStaffs: Staff[],
  pdfPageHeight: number,
  scale: number,
  minHeightPdf: number,
): Staff[] {
  const { separators } = computeSeparators(pageStaffs, pdfPageHeight, scale);
  if (separatorIndex < 0 || separatorIndex >= separators.length) return staffs;

  const sep = separators[separatorIndex];
  const newPdfY = canvasYToPdfY(newCanvasY, pdfPageHeight, scale);

  // Build a set of updates: staffId → { field: newValue }
  const updates = new Map<string, Partial<Staff>>();

  if (sep.staffAboveId) {
    const above = staffs.find(s => s.id === sep.staffAboveId)!;
    // Clamp: bottom cannot go above top - minHeight
    const clampedBottom = Math.min(newPdfY, above.top - minHeightPdf);
    updates.set(sep.staffAboveId, { bottom: clampedBottom });
  }

  if (sep.staffBelowId) {
    const below = staffs.find(s => s.id === sep.staffBelowId)!;
    // Clamp: top cannot go below bottom + minHeight
    const clampedTop = Math.max(newPdfY, below.bottom + minHeightPdf);
    updates.set(sep.staffBelowId, { top: clampedTop });
  }

  return staffs.map(s => {
    const update = updates.get(s.id);
    if (update) return { ...s, ...update };
    return s;
  });
}

/**
 * Split a system at an arbitrary PDF Y position on a given page.
 *
 * Three cases:
 * 1. pdfY falls in a gap between two staffs within the same system
 *    → delegate to splitSystemAtGap
 * 2. pdfY falls inside a staff but near an adjacent staff boundary (within MIN_SPLIT_HEIGHT)
 *    → treat as gap split at the nearest boundary (avoids creating tiny staffs)
 * 3. pdfY falls inside a staff far from boundaries
 *    → split the staff first, then split the system between the two halves
 *
 * Returns staffs unchanged if pdfY is outside all systems on the page.
 */
export function splitSystemAtPosition(
  staffs: Staff[],
  pageIndex: number,
  pdfY: number,
  systems?: System[],
): { staffs: Staff[]; systems: System[] } {
  const pageStaffs = staffs.filter(s => s.pageIndex === pageIndex);
  if (pageStaffs.length === 0) return { staffs, systems: systems ?? [] };

  // Group by systemId
  const groupMap = new Map<string, Staff[]>();
  for (const staff of pageStaffs) {
    const group = groupMap.get(staff.systemId) ?? [];
    group.push(staff);
    groupMap.set(staff.systemId, group);
  }

  for (const [, groupStaffs] of groupMap) {
    const sorted = [...groupStaffs].sort((a, b) => b.top - a.top);

    const systemTop = sorted[0].top;
    const systemBottom = sorted[sorted.length - 1].bottom;
    if (pdfY > systemTop || pdfY < systemBottom) continue;

    // Case 1: Check gaps between adjacent staffs
    for (let i = 0; i < sorted.length - 1; i++) {
      const current = sorted[i];
      const next = sorted[i + 1];
      if (pdfY <= current.bottom && pdfY >= next.top) {
        return splitSystemAtGap(staffs, current.id, next.id, systems);
      }
    }

    // Case 2 & 3: pdfY is inside a staff
    for (let i = 0; i < sorted.length; i++) {
      const staff = sorted[i];
      if (pdfY <= staff.top && pdfY >= staff.bottom) {
        if (i > 0) {
          const above = sorted[i - 1];
          const distToAboveBoundary = staff.top - pdfY;
          if (distToAboveBoundary < MIN_SPLIT_HEIGHT) {
            return splitSystemAtGap(staffs, above.id, staff.id, systems);
          }
        }
        if (i < sorted.length - 1) {
          const below = sorted[i + 1];
          const distToBelowBoundary = pdfY - staff.bottom;
          if (distToBelowBoundary < MIN_SPLIT_HEIGHT) {
            return splitSystemAtGap(staffs, staff.id, below.id, systems);
          }
        }

        const splitResult = splitStaffAtPosition(staffs, staff.id, pdfY);
        const upperIdx = splitResult.findIndex(s => s.id === staff.id);
        const lowerHalf = splitResult[upperIdx + 1];
        return splitSystemAtGap(splitResult, staff.id, lowerHalf.id, systems);
      }
    }
  }

  return { staffs, systems: systems ?? [] };
}

const DEFAULT_HALF_HEIGHT = 25;

/**
 * Create a new staff at the given PDF Y position on a page.
 * The staff is centered at pdfY with a default height of 50 PDF units,
 * clamped to page bounds [0, pdfPageHeight].
 */
export function addStaffAtPosition(
  staffs: Staff[],
  pageIndex: number,
  pdfY: number,
  pdfPageHeight: number,
  systems?: System[],
): { staffs: Staff[]; systems: System[] } {
  const rawTop = pdfY + DEFAULT_HALF_HEIGHT;
  const rawBottom = pdfY - DEFAULT_HALF_HEIGHT;
  const height = rawTop - rawBottom;

  let top = rawTop;
  let bottom = rawBottom;

  if (top > pdfPageHeight) {
    top = pdfPageHeight;
    bottom = pdfPageHeight - height;
  }
  if (bottom < 0) {
    bottom = 0;
    top = height;
  }

  // Infer systemId from the nearest staff on the same page
  const pageStaffs = staffs
    .filter(s => s.pageIndex === pageIndex)
    .sort((a, b) => b.top - a.top);

  let systemId = '';
  if (pageStaffs.length > 0) {
    let nearest = pageStaffs[0];
    let minDist = Infinity;
    for (const s of pageStaffs) {
      const center = (s.top + s.bottom) / 2;
      const dist = Math.abs(center - pdfY);
      if (dist < minDist) {
        minDist = dist;
        nearest = s;
      }
    }
    systemId = nearest.systemId;
  }

  const newStaff: Staff = {
    id: crypto.randomUUID(),
    pageIndex,
    top,
    bottom,
    label: '',
    systemId,
  };

  return { staffs: [...staffs, newStaff], systems: systems ?? [] };
}

const MIN_SPLIT_HEIGHT = 10;

/**
 * Split a staff at a specified PDF Y position.
 * The original staff keeps its id and the upper portion.
 * A new staff is created for the lower portion and inserted right after.
 * Clamps so both halves maintain at least MIN_SPLIT_HEIGHT.
 */
export function splitStaffAtPosition(staffs: Staff[], staffId: string, splitPdfY: number): Staff[] {
  const idx = staffs.findIndex(s => s.id === staffId);
  if (idx === -1) return staffs;

  const staff = staffs[idx];
  // Clamp splitPdfY so both halves have at least MIN_SPLIT_HEIGHT
  const clamped = Math.max(
    staff.bottom + MIN_SPLIT_HEIGHT,
    Math.min(splitPdfY, staff.top - MIN_SPLIT_HEIGHT),
  );

  const upper: Staff = { ...staff, bottom: clamped };
  const lower: Staff = {
    ...staff,
    id: crypto.randomUUID(),
    top: clamped,
  };

  const result = [...staffs];
  result.splice(idx, 1, upper, lower);
  return result;
}

/**
 * Merge two adjacent staffs by removing the separator between them.
 * The upper staff keeps its id, label, and systemId.
 * The lower staff is removed and its bottom boundary becomes the merged staff's bottom.
 */
export function mergeSeparator(staffs: Staff[], staffAboveId: string, staffBelowId: string): Staff[] {
  const aboveIdx = staffs.findIndex(s => s.id === staffAboveId);
  const belowIdx = staffs.findIndex(s => s.id === staffBelowId);
  if (aboveIdx === -1 || belowIdx === -1) return staffs;

  const above = staffs[aboveIdx];
  const below = staffs[belowIdx];

  const merged: Staff = { ...above, bottom: below.bottom };

  return staffs
    .filter(s => s.id !== staffBelowId)
    .map(s => s.id === staffAboveId ? merged : s);
}
