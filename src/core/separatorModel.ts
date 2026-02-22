import type { Staff } from './staffModel';
import { pdfYToCanvasY, canvasYToPdfY } from './coordinateMapper';

export type SeparatorKind = 'edge' | 'part';

export interface Separator {
  kind: SeparatorKind;
  canvasY: number;
  staffAboveId: string | null;
  staffBelowId: string | null;
}

interface StaffRegion {
  staffId: string;
  topCanvasY: number;
  bottomCanvasY: number;
  label: string;
  systemIndex: number;
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

export function computeSeparators(
  pageStaffs: Staff[],
  pdfPageHeight: number,
  scale: number,
): { separators: Separator[]; regions: StaffRegion[] } {
  if (pageStaffs.length === 0) {
    return { separators: [], regions: [] };
  }

  const sorted = sortByVisualPosition(pageStaffs, pdfPageHeight, scale);
  const separators: Separator[] = [];
  const regions: StaffRegion[] = [];

  // Top edge separator
  separators.push({
    kind: 'edge',
    canvasY: pdfYToCanvasY(sorted[0].top, pdfPageHeight, scale),
    staffAboveId: null,
    staffBelowId: sorted[0].id,
  });

  for (let i = 0; i < sorted.length; i++) {
    const staff = sorted[i];

    // Add region
    regions.push({
      staffId: staff.id,
      topCanvasY: pdfYToCanvasY(staff.top, pdfPageHeight, scale),
      bottomCanvasY: pdfYToCanvasY(staff.bottom, pdfPageHeight, scale),
      label: staff.label,
      systemIndex: staff.systemIndex,
    });

    // Add separator between this staff and the next
    if (i < sorted.length - 1) {
      const next = sorted[i + 1];
      const kind: SeparatorKind = 'part';
      // Use the boundary between bottom of current and top of next
      // If they share a boundary, these are the same; otherwise use midpoint
      const bottomY = pdfYToCanvasY(staff.bottom, pdfPageHeight, scale);
      const topY = pdfYToCanvasY(next.top, pdfPageHeight, scale);
      separators.push({
        kind,
        canvasY: (bottomY + topY) / 2,
        staffAboveId: staff.id,
        staffBelowId: next.id,
      });
    }
  }

  // Bottom edge separator
  const last = sorted[sorted.length - 1];
  separators.push({
    kind: 'edge',
    canvasY: pdfYToCanvasY(last.bottom, pdfPageHeight, scale),
    staffAboveId: last.id,
    staffBelowId: null,
  });

  return { separators, regions };
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

  const newStaff: Staff = {
    id: crypto.randomUUID(),
    pageIndex,
    top,
    bottom,
    label: '',
    systemIndex: 0,
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
