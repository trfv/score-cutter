import type { Staff } from './staffModel';
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
  systemIndex: number;
}

export interface SystemGroup {
  systemIndex: number;
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
 * Group staffs by systemIndex and compute separators/regions per group.
 * Each group gets its own edge separators at top/bottom and part separators between staffs.
 */
export function computeSystemGroups(
  pageStaffs: Staff[],
  pdfPageHeight: number,
  scale: number,
): SystemGroup[] {
  if (pageStaffs.length === 0) return [];

  // Group by systemIndex
  const groupMap = new Map<number, Staff[]>();
  for (const staff of pageStaffs) {
    const group = groupMap.get(staff.systemIndex) ?? [];
    group.push(staff);
    groupMap.set(staff.systemIndex, group);
  }

  // Sort groups by systemIndex, then sort staffs within each group
  const systemIndices = [...groupMap.keys()].sort((a, b) => a - b);

  return systemIndices.map(sysIdx => {
    const groupStaffs = sortByVisualPosition(groupMap.get(sysIdx)!, pdfPageHeight, scale);
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
        systemIndex: staff.systemIndex,
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

    return {
      systemIndex: sysIdx,
      topCanvasY: pdfYToCanvasY(groupStaffs[0].top, pdfPageHeight, scale),
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
 * staffBelow and all staffs below it in the same original system get systemIndex + 1.
 * All staffs in subsequent systems also get their systemIndex incremented.
 */
export function splitSystemAtGap(staffs: Staff[], staffAboveId: string, staffBelowId: string): Staff[] {
  const above = staffs.find(s => s.id === staffAboveId);
  const below = staffs.find(s => s.id === staffBelowId);
  if (!above || !below) return staffs;
  if (above.systemIndex !== below.systemIndex) return staffs;

  const splitSystemIdx = above.systemIndex;
  const pageIndex = above.pageIndex;

  // Determine which staffs in this system are "below" the split point.
  // staffBelow and all staffs with top <= below.top in the same system on the same page.
  const belowTop = below.top;

  return staffs.map(s => {
    if (s.pageIndex !== pageIndex) return s;
    if (s.systemIndex === splitSystemIdx && s.top <= belowTop) {
      return { ...s, systemIndex: s.systemIndex + 1 };
    }
    if (s.systemIndex > splitSystemIdx) {
      return { ...s, systemIndex: s.systemIndex + 1 };
    }
    return s;
  });
}

/**
 * Merge two adjacent systems on a page.
 * All staffs in system upperSystemIndex + 1 get set to upperSystemIndex.
 * Subsequent systems get decremented.
 */
export function mergeAdjacentSystems(staffs: Staff[], pageIndex: number, upperSystemIndex: number): Staff[] {
  const lowerSystemIndex = upperSystemIndex + 1;
  const hasUpper = staffs.some(s => s.pageIndex === pageIndex && s.systemIndex === upperSystemIndex);
  const hasLower = staffs.some(s => s.pageIndex === pageIndex && s.systemIndex === lowerSystemIndex);
  if (!hasUpper || !hasLower) return staffs;

  return staffs.map(s => {
    if (s.pageIndex !== pageIndex) return s;
    if (s.systemIndex === lowerSystemIndex) {
      return { ...s, systemIndex: upperSystemIndex };
    }
    if (s.systemIndex > lowerSystemIndex) {
      return { ...s, systemIndex: s.systemIndex - 1 };
    }
    return s;
  });
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
): Staff[] {
  // Find all distinct systemIndex values on this page, sorted
  const pageStaffs = staffs.filter(s => s.pageIndex === pageIndex);
  const systemIndices = [...new Set(pageStaffs.map(s => s.systemIndex))].sort((a, b) => a - b);

  if (systemSepIndex < 0 || systemSepIndex >= systemIndices.length - 1) return staffs;

  const upperSysIdx = systemIndices[systemSepIndex];
  const lowerSysIdx = systemIndices[systemSepIndex + 1];

  return staffs.map(s => {
    if (s.pageIndex !== pageIndex) return s;
    if (s.systemIndex !== upperSysIdx && s.systemIndex !== lowerSysIdx) return s;

    const centerCanvasY = (
      pdfYToCanvasY(s.top, pdfPageHeight, scale) +
      pdfYToCanvasY(s.bottom, pdfPageHeight, scale)
    ) / 2;

    if (centerCanvasY < newCanvasY) {
      // Staff center is above the drag position → upper system
      return { ...s, systemIndex: upperSysIdx };
    } else {
      // Staff center is at or below → lower system
      return { ...s, systemIndex: lowerSysIdx };
    }
  });
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
): Staff[] {
  const pageStaffs = staffs.filter(s => s.pageIndex === pageIndex);
  if (pageStaffs.length === 0) return staffs;

  // Group by systemIndex
  const groupMap = new Map<number, Staff[]>();
  for (const staff of pageStaffs) {
    const group = groupMap.get(staff.systemIndex) ?? [];
    group.push(staff);
    groupMap.set(staff.systemIndex, group);
  }

  for (const [, groupStaffs] of groupMap) {
    // Sort by descending top (visual top-to-bottom in PDF coords)
    const sorted = [...groupStaffs].sort((a, b) => b.top - a.top);

    // Check if pdfY falls within this system's vertical range
    const systemTop = sorted[0].top;
    const systemBottom = sorted[sorted.length - 1].bottom;
    if (pdfY > systemTop || pdfY < systemBottom) continue;

    // Case 1: Check gaps between adjacent staffs
    for (let i = 0; i < sorted.length - 1; i++) {
      const current = sorted[i];
      const next = sorted[i + 1];
      if (pdfY <= current.bottom && pdfY >= next.top) {
        return splitSystemAtGap(staffs, current.id, next.id);
      }
    }

    // Case 2 & 3: pdfY is inside a staff
    for (let i = 0; i < sorted.length; i++) {
      const staff = sorted[i];
      if (pdfY <= staff.top && pdfY >= staff.bottom) {
        // Check proximity to adjacent staff boundaries
        // Above neighbor: the staff at index i-1 (if exists)
        if (i > 0) {
          const above = sorted[i - 1];
          const distToAboveBoundary = staff.top - pdfY;
          if (distToAboveBoundary < MIN_SPLIT_HEIGHT) {
            return splitSystemAtGap(staffs, above.id, staff.id);
          }
        }
        // Below neighbor: the staff at index i+1 (if exists)
        if (i < sorted.length - 1) {
          const below = sorted[i + 1];
          const distToBelowBoundary = pdfY - staff.bottom;
          if (distToBelowBoundary < MIN_SPLIT_HEIGHT) {
            return splitSystemAtGap(staffs, staff.id, below.id);
          }
        }

        // Far from boundaries: split the staff, then split the system
        const splitResult = splitStaffAtPosition(staffs, staff.id, pdfY);
        const upperIdx = splitResult.findIndex(s => s.id === staff.id);
        const lowerHalf = splitResult[upperIdx + 1];
        return splitSystemAtGap(splitResult, staff.id, lowerHalf.id);
      }
    }
  }

  return staffs;
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
): Staff[] {
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

  // Infer systemIndex from the nearest staff on the same page
  const pageStaffs = staffs
    .filter(s => s.pageIndex === pageIndex)
    .sort((a, b) => b.top - a.top); // sorted top-to-bottom in PDF coords

  let systemIndex = 0;
  if (pageStaffs.length > 0) {
    // Find the nearest staff by distance to pdfY center
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
    systemIndex = nearest.systemIndex;
  }

  const newStaff: Staff = {
    id: crypto.randomUUID(),
    pageIndex,
    top,
    bottom,
    label: '',
    systemIndex,
  };

  return [...staffs, newStaff];
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
 * The upper staff keeps its id, label, and systemIndex.
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
