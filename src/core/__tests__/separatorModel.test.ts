import { describe, it, expect } from 'vitest';
import type { Staff } from '../staffModel';
import {
  computeSeparators,
  computeSystemGroups,
  splitSystemAtGap,
  splitSystemAtPosition,
  mergeAdjacentSystems,
  reassignStaffsByDrag,
  applySeparatorDrag,
  splitStaffAtPosition,
  mergeSeparator,
  addStaffAtPosition,
} from '../separatorModel';

// Helper: create a Staff with defaults
function makeStaff(overrides: Partial<Staff> & { id: string }): Staff {
  return {
    pageIndex: 0,
    top: 100,
    bottom: 50,
    label: '',
    systemIndex: 0,
    ...overrides,
  };
}

// PDF page height = 792 (standard US Letter), scale = 150/72 ≈ 2.0833
const PAGE_HEIGHT = 792;
const SCALE = 150 / 72;

describe('separatorModel', () => {
  describe('computeSeparators', () => {
    it('returns empty for no staffs', () => {
      const result = computeSeparators([], PAGE_HEIGHT, SCALE);
      expect(result.separators).toEqual([]);
      expect(result.regions).toEqual([]);
    });

    it('returns 2 edge separators for a single staff', () => {
      const staffs = [makeStaff({ id: 'a', top: 600, bottom: 400 })];
      const result = computeSeparators(staffs, PAGE_HEIGHT, SCALE);

      expect(result.separators).toHaveLength(2);
      expect(result.regions).toHaveLength(1);

      // Top edge
      expect(result.separators[0].kind).toBe('edge');
      expect(result.separators[0].staffAboveId).toBeNull();
      expect(result.separators[0].staffBelowId).toBe('a');

      // Bottom edge
      expect(result.separators[1].kind).toBe('edge');
      expect(result.separators[1].staffAboveId).toBe('a');
      expect(result.separators[1].staffBelowId).toBeNull();

      // Region
      expect(result.regions[0].staffId).toBe('a');
    });

    it('returns 3 separators for 2 staffs in same system (part separator)', () => {
      const staffs = [
        makeStaff({ id: 'a', top: 700, bottom: 500, systemIndex: 0 }),
        makeStaff({ id: 'b', top: 500, bottom: 300, systemIndex: 0 }),
      ];
      const result = computeSeparators(staffs, PAGE_HEIGHT, SCALE);

      expect(result.separators).toHaveLength(3);
      expect(result.regions).toHaveLength(2);

      expect(result.separators[0].kind).toBe('edge');
      expect(result.separators[1].kind).toBe('part');
      expect(result.separators[2].kind).toBe('edge');

      // Middle separator connects staff a (above) and staff b (below)
      expect(result.separators[1].staffAboveId).toBe('a');
      expect(result.separators[1].staffBelowId).toBe('b');
    });

    it('returns separate edge separators for staffs in different systems', () => {
      const staffs = [
        makeStaff({ id: 'a', top: 700, bottom: 500, systemIndex: 0 }),
        makeStaff({ id: 'b', top: 400, bottom: 200, systemIndex: 1 }),
      ];
      const result = computeSeparators(staffs, PAGE_HEIGHT, SCALE);

      // System 0: edge(top-a), edge(bottom-a) = 2
      // System 1: edge(top-b), edge(bottom-b) = 2
      expect(result.separators).toHaveLength(4);
      expect(result.separators[0].kind).toBe('edge');
      expect(result.separators[1].kind).toBe('edge');
      expect(result.separators[2].kind).toBe('edge');
      expect(result.separators[3].kind).toBe('edge');
    });

    it('handles 3 staffs across different systems with per-system separators', () => {
      const staffs = [
        makeStaff({ id: 'a', top: 700, bottom: 600, systemIndex: 0 }),
        makeStaff({ id: 'b', top: 600, bottom: 500, systemIndex: 0 }),
        makeStaff({ id: 'c', top: 400, bottom: 300, systemIndex: 1 }),
      ];
      const result = computeSeparators(staffs, PAGE_HEIGHT, SCALE);

      // System 0: edge(top-a), part(a-b), edge(bottom-b) = 3
      // System 1: edge(top-c), edge(bottom-c) = 2
      expect(result.separators).toHaveLength(5);
      expect(result.separators[0].kind).toBe('edge');   // top of a
      expect(result.separators[1].kind).toBe('part');    // between a and b
      expect(result.separators[2].kind).toBe('edge');   // bottom of b
      expect(result.separators[3].kind).toBe('edge');   // top of c
      expect(result.separators[4].kind).toBe('edge');   // bottom of c
    });

    it('sorts staffs by visual position (top to bottom in canvas)', () => {
      // Staffs provided in random order
      const staffs = [
        makeStaff({ id: 'c', top: 300, bottom: 200, systemIndex: 1 }),
        makeStaff({ id: 'a', top: 700, bottom: 600, systemIndex: 0 }),
        makeStaff({ id: 'b', top: 500, bottom: 400, systemIndex: 0 }),
      ];
      const result = computeSeparators(staffs, PAGE_HEIGHT, SCALE);

      // Regions should be sorted top to bottom (a, b, c)
      expect(result.regions[0].staffId).toBe('a');
      expect(result.regions[1].staffId).toBe('b');
      expect(result.regions[2].staffId).toBe('c');
    });

    it('computes correct canvas Y positions for separators', () => {
      const staffs = [makeStaff({ id: 'a', top: 600, bottom: 400 })];
      const result = computeSeparators(staffs, PAGE_HEIGHT, SCALE);

      // pdfYToCanvasY(600, 792, scale) = (792 - 600) * scale
      const expectedTopY = (PAGE_HEIGHT - 600) * SCALE;
      // pdfYToCanvasY(400, 792, scale) = (792 - 400) * scale
      const expectedBottomY = (PAGE_HEIGHT - 400) * SCALE;

      expect(result.separators[0].canvasY).toBeCloseTo(expectedTopY, 5);
      expect(result.separators[1].canvasY).toBeCloseTo(expectedBottomY, 5);
    });

    it('computes correct canvas Y positions for regions', () => {
      const staffs = [makeStaff({ id: 'a', top: 600, bottom: 400 })];
      const result = computeSeparators(staffs, PAGE_HEIGHT, SCALE);

      const expectedTopY = (PAGE_HEIGHT - 600) * SCALE;
      const expectedBottomY = (PAGE_HEIGHT - 400) * SCALE;

      expect(result.regions[0].topCanvasY).toBeCloseTo(expectedTopY, 5);
      expect(result.regions[0].bottomCanvasY).toBeCloseTo(expectedBottomY, 5);
    });
  });

  describe('computeSystemGroups', () => {
    it('returns empty array for no staffs', () => {
      const result = computeSystemGroups([], PAGE_HEIGHT, SCALE);
      expect(result).toEqual([]);
    });

    it('returns one group for staffs in the same system', () => {
      const staffs = [
        makeStaff({ id: 'a', top: 700, bottom: 600, systemIndex: 0 }),
        makeStaff({ id: 'b', top: 600, bottom: 500, systemIndex: 0 }),
      ];
      const result = computeSystemGroups(staffs, PAGE_HEIGHT, SCALE);

      expect(result).toHaveLength(1);
      expect(result[0].systemIndex).toBe(0);
      expect(result[0].separators).toHaveLength(3); // edge, part, edge
      expect(result[0].regions).toHaveLength(2);
    });

    it('returns separate groups for different systemIndex', () => {
      const staffs = [
        makeStaff({ id: 'a', top: 700, bottom: 600, systemIndex: 0 }),
        makeStaff({ id: 'b', top: 600, bottom: 500, systemIndex: 0 }),
        makeStaff({ id: 'c', top: 400, bottom: 300, systemIndex: 1 }),
      ];
      const result = computeSystemGroups(staffs, PAGE_HEIGHT, SCALE);

      expect(result).toHaveLength(2);

      // System 0
      expect(result[0].systemIndex).toBe(0);
      expect(result[0].regions).toHaveLength(2);
      expect(result[0].separators).toHaveLength(3); // edge, part, edge

      // System 1
      expect(result[1].systemIndex).toBe(1);
      expect(result[1].regions).toHaveLength(1);
      expect(result[1].separators).toHaveLength(2); // edge, edge
    });

    it('computes correct topCanvasY and bottomCanvasY for each group', () => {
      const staffs = [
        makeStaff({ id: 'a', top: 700, bottom: 600, systemIndex: 0 }),
        makeStaff({ id: 'b', top: 400, bottom: 300, systemIndex: 1 }),
      ];
      const result = computeSystemGroups(staffs, PAGE_HEIGHT, SCALE);

      // System 0: top of staff a → bottom of staff a
      expect(result[0].topCanvasY).toBeCloseTo((PAGE_HEIGHT - 700) * SCALE, 5);
      expect(result[0].bottomCanvasY).toBeCloseTo((PAGE_HEIGHT - 600) * SCALE, 5);

      // System 1: top of staff b → bottom of staff b
      expect(result[1].topCanvasY).toBeCloseTo((PAGE_HEIGHT - 400) * SCALE, 5);
      expect(result[1].bottomCanvasY).toBeCloseTo((PAGE_HEIGHT - 300) * SCALE, 5);
    });

    it('groups are sorted by systemIndex', () => {
      const staffs = [
        makeStaff({ id: 'c', top: 300, bottom: 200, systemIndex: 1 }),
        makeStaff({ id: 'a', top: 700, bottom: 600, systemIndex: 0 }),
      ];
      const result = computeSystemGroups(staffs, PAGE_HEIGHT, SCALE);

      expect(result[0].systemIndex).toBe(0);
      expect(result[1].systemIndex).toBe(1);
    });

    it('handles a single staff as one group', () => {
      const staffs = [makeStaff({ id: 'a', top: 600, bottom: 400 })];
      const result = computeSystemGroups(staffs, PAGE_HEIGHT, SCALE);

      expect(result).toHaveLength(1);
      expect(result[0].systemIndex).toBe(0);
      expect(result[0].separators).toHaveLength(2); // edge, edge
      expect(result[0].regions).toHaveLength(1);
    });
  });

  describe('splitSystemAtGap', () => {
    it('splits a single system into two at the specified gap', () => {
      const staffs = [
        makeStaff({ id: 'a', top: 700, bottom: 600, systemIndex: 0 }),
        makeStaff({ id: 'b', top: 500, bottom: 400, systemIndex: 0 }),
      ];
      const result = splitSystemAtGap(staffs, 'a', 'b');

      expect(result.find(s => s.id === 'a')!.systemIndex).toBe(0);
      expect(result.find(s => s.id === 'b')!.systemIndex).toBe(1);
    });

    it('increments systemIndex of all staffs below the split', () => {
      const staffs = [
        makeStaff({ id: 'a', top: 700, bottom: 600, systemIndex: 0 }),
        makeStaff({ id: 'b', top: 500, bottom: 400, systemIndex: 0 }),
        makeStaff({ id: 'c', top: 300, bottom: 200, systemIndex: 0 }),
      ];
      const result = splitSystemAtGap(staffs, 'a', 'b');

      expect(result.find(s => s.id === 'a')!.systemIndex).toBe(0);
      expect(result.find(s => s.id === 'b')!.systemIndex).toBe(1);
      expect(result.find(s => s.id === 'c')!.systemIndex).toBe(1);
    });

    it('shifts subsequent systems when splitting', () => {
      const staffs = [
        makeStaff({ id: 'a', top: 700, bottom: 600, systemIndex: 0 }),
        makeStaff({ id: 'b', top: 500, bottom: 400, systemIndex: 0 }),
        makeStaff({ id: 'c', top: 300, bottom: 200, systemIndex: 1 }),
      ];
      const result = splitSystemAtGap(staffs, 'a', 'b');

      expect(result.find(s => s.id === 'a')!.systemIndex).toBe(0);
      expect(result.find(s => s.id === 'b')!.systemIndex).toBe(1);
      expect(result.find(s => s.id === 'c')!.systemIndex).toBe(2);
    });

    it('returns unchanged if staffAboveId not found', () => {
      const staffs = [makeStaff({ id: 'a', top: 700, bottom: 600, systemIndex: 0 })];
      const result = splitSystemAtGap(staffs, 'nonexistent', 'a');
      expect(result).toEqual(staffs);
    });

    it('returns unchanged if staffs are in different systems', () => {
      const staffs = [
        makeStaff({ id: 'a', top: 700, bottom: 600, systemIndex: 0 }),
        makeStaff({ id: 'b', top: 500, bottom: 400, systemIndex: 1 }),
      ];
      const result = splitSystemAtGap(staffs, 'a', 'b');
      expect(result).toEqual(staffs);
    });

    it('does not affect staffs on other pages', () => {
      const staffs = [
        makeStaff({ id: 'a', pageIndex: 0, top: 700, bottom: 600, systemIndex: 0 }),
        makeStaff({ id: 'b', pageIndex: 0, top: 500, bottom: 400, systemIndex: 0 }),
        makeStaff({ id: 'c', pageIndex: 1, top: 400, bottom: 300, systemIndex: 0 }),
        makeStaff({ id: 'd', pageIndex: 1, top: 200, bottom: 100, systemIndex: 1 }),
      ];
      const result = splitSystemAtGap(staffs, 'a', 'b');

      // Page 0 staffs should be split
      expect(result.find(s => s.id === 'a')!.systemIndex).toBe(0);
      expect(result.find(s => s.id === 'b')!.systemIndex).toBe(1);
      // Page 1 staffs must remain unchanged
      expect(result.find(s => s.id === 'c')!.systemIndex).toBe(0);
      expect(result.find(s => s.id === 'd')!.systemIndex).toBe(1);
    });
  });

  describe('mergeAdjacentSystems', () => {
    it('merges two adjacent systems into one', () => {
      const staffs = [
        makeStaff({ id: 'a', top: 700, bottom: 600, systemIndex: 0 }),
        makeStaff({ id: 'b', top: 500, bottom: 400, systemIndex: 1 }),
      ];
      const result = mergeAdjacentSystems(staffs, 0, 0);

      expect(result.find(s => s.id === 'a')!.systemIndex).toBe(0);
      expect(result.find(s => s.id === 'b')!.systemIndex).toBe(0);
    });

    it('decrements subsequent systems after merge', () => {
      const staffs = [
        makeStaff({ id: 'a', top: 700, bottom: 600, systemIndex: 0 }),
        makeStaff({ id: 'b', top: 500, bottom: 400, systemIndex: 1 }),
        makeStaff({ id: 'c', top: 300, bottom: 200, systemIndex: 2 }),
      ];
      const result = mergeAdjacentSystems(staffs, 0, 0);

      expect(result.find(s => s.id === 'a')!.systemIndex).toBe(0);
      expect(result.find(s => s.id === 'b')!.systemIndex).toBe(0);
      expect(result.find(s => s.id === 'c')!.systemIndex).toBe(1);
    });

    it('only affects staffs on the specified page', () => {
      const staffs = [
        makeStaff({ id: 'a', pageIndex: 0, top: 700, bottom: 600, systemIndex: 0 }),
        makeStaff({ id: 'b', pageIndex: 0, top: 500, bottom: 400, systemIndex: 1 }),
        makeStaff({ id: 'c', pageIndex: 1, top: 700, bottom: 600, systemIndex: 1 }),
      ];
      const result = mergeAdjacentSystems(staffs, 0, 0);

      expect(result.find(s => s.id === 'b')!.systemIndex).toBe(0);
      // Page 1 staff should be unchanged
      expect(result.find(s => s.id === 'c')!.systemIndex).toBe(1);
    });

    it('returns unchanged if upperSystemIndex has no staffs', () => {
      const staffs = [
        makeStaff({ id: 'a', top: 700, bottom: 600, systemIndex: 0 }),
      ];
      const result = mergeAdjacentSystems(staffs, 0, 5);
      expect(result).toEqual(staffs);
    });
  });

  describe('reassignStaffsByDrag', () => {
    it('moves a staff to the upper system when dragged below its center', () => {
      // System 0: staff a (top=700, bottom=600, center=650 → canvasY=(792-650)*scale)
      // System 1: staff b (top=400, bottom=300, center=350 → canvasY=(792-350)*scale)
      // System separator between them.
      // Drag separator below staff b's center → b moves to system 0
      const staffs = [
        makeStaff({ id: 'a', top: 700, bottom: 600, systemIndex: 0 }),
        makeStaff({ id: 'b', top: 400, bottom: 300, systemIndex: 1 }),
      ];
      // newCanvasY below b's center (canvas Y > center canvas Y means lower on screen)
      const bCenterCanvasY = (PAGE_HEIGHT - 350) * SCALE;
      const newCanvasY = bCenterCanvasY + 10;

      const result = reassignStaffsByDrag(staffs, 0, 0, newCanvasY, PAGE_HEIGHT, SCALE);

      expect(result.find(s => s.id === 'a')!.systemIndex).toBe(0);
      expect(result.find(s => s.id === 'b')!.systemIndex).toBe(0);
    });

    it('moves a staff to the lower system when dragged above its center', () => {
      // System 0: staff a (center=650) and staff b (center=450)
      // Drag separator above staff b's center → b moves to system 1
      const staffs = [
        makeStaff({ id: 'a', top: 700, bottom: 600, systemIndex: 0 }),
        makeStaff({ id: 'b', top: 500, bottom: 400, systemIndex: 0 }),
        makeStaff({ id: 'c', top: 300, bottom: 200, systemIndex: 1 }),
      ];
      // Drag the separator between system 0 and system 1 (systemSepIndex=0)
      // to above staff b's center
      const bCenterCanvasY = (PAGE_HEIGHT - 450) * SCALE;
      const newCanvasY = bCenterCanvasY - 10;

      const result = reassignStaffsByDrag(staffs, 0, 0, newCanvasY, PAGE_HEIGHT, SCALE);

      expect(result.find(s => s.id === 'a')!.systemIndex).toBe(0);
      expect(result.find(s => s.id === 'b')!.systemIndex).toBe(1);
      expect(result.find(s => s.id === 'c')!.systemIndex).toBe(1);
    });

    it('does nothing when drag stays between the same staffs', () => {
      const staffs = [
        makeStaff({ id: 'a', top: 700, bottom: 600, systemIndex: 0 }),
        makeStaff({ id: 'b', top: 400, bottom: 300, systemIndex: 1 }),
      ];
      // Drag to midpoint between systems (no staff centers crossed)
      const midCanvasY = (PAGE_HEIGHT - 500) * SCALE;

      const result = reassignStaffsByDrag(staffs, 0, 0, midCanvasY, PAGE_HEIGHT, SCALE);

      expect(result.find(s => s.id === 'a')!.systemIndex).toBe(0);
      expect(result.find(s => s.id === 'b')!.systemIndex).toBe(1);
    });

    it('returns unchanged when systemSepIndex is out of range', () => {
      const staffs = [
        makeStaff({ id: 'a', top: 700, bottom: 600, systemIndex: 0 }),
      ];
      const result = reassignStaffsByDrag(staffs, 0, 5, 100, PAGE_HEIGHT, SCALE);
      expect(result).toEqual(staffs);
    });
  });

  describe('applySeparatorDrag', () => {
    it('dragging internal separator updates both adjacent staffs', () => {
      const staffs = [
        makeStaff({ id: 'a', top: 700, bottom: 500, systemIndex: 0 }),
        makeStaff({ id: 'b', top: 500, bottom: 300, systemIndex: 0 }),
      ];
      const pageStaffs = staffs;
      // Separator index 1 is between a and b
      // Move it to a new canvas Y that corresponds to PDF Y 450
      const newCanvasY = (PAGE_HEIGHT - 450) * SCALE;

      const result = applySeparatorDrag(
        staffs, 1, newCanvasY, pageStaffs, PAGE_HEIGHT, SCALE, 10,
      );

      const updatedA = result.find(s => s.id === 'a')!;
      const updatedB = result.find(s => s.id === 'b')!;
      expect(updatedA.bottom).toBeCloseTo(450, 0);
      expect(updatedB.top).toBeCloseTo(450, 0);
      // Other boundaries unchanged
      expect(updatedA.top).toBe(700);
      expect(updatedB.bottom).toBe(300);
    });

    it('dragging top edge separator updates only the staff below', () => {
      const staffs = [makeStaff({ id: 'a', top: 600, bottom: 400 })];
      const pageStaffs = staffs;
      // Separator index 0 is the top edge
      const newCanvasY = (PAGE_HEIGHT - 650) * SCALE;

      const result = applySeparatorDrag(
        staffs, 0, newCanvasY, pageStaffs, PAGE_HEIGHT, SCALE, 10,
      );

      const updated = result.find(s => s.id === 'a')!;
      expect(updated.top).toBeCloseTo(650, 0);
      expect(updated.bottom).toBe(400);
    });

    it('dragging bottom edge separator updates only the staff above', () => {
      const staffs = [makeStaff({ id: 'a', top: 600, bottom: 400 })];
      const pageStaffs = staffs;
      // Separator index 1 is the bottom edge
      const newCanvasY = (PAGE_HEIGHT - 350) * SCALE;

      const result = applySeparatorDrag(
        staffs, 1, newCanvasY, pageStaffs, PAGE_HEIGHT, SCALE, 10,
      );

      const updated = result.find(s => s.id === 'a')!;
      expect(updated.top).toBe(600);
      expect(updated.bottom).toBeCloseTo(350, 0);
    });

    it('clamps drag to maintain minimum staff height', () => {
      const staffs = [
        makeStaff({ id: 'a', top: 700, bottom: 500, systemIndex: 0 }),
        makeStaff({ id: 'b', top: 500, bottom: 300, systemIndex: 0 }),
      ];
      const pageStaffs = staffs;
      // Try to drag separator 1 to almost the top of staff a (PDF Y 695)
      const newCanvasY = (PAGE_HEIGHT - 695) * SCALE;

      const result = applySeparatorDrag(
        staffs, 1, newCanvasY, pageStaffs, PAGE_HEIGHT, SCALE, 10,
      );

      const updatedA = result.find(s => s.id === 'a')!;
      // Staff a should maintain at least minHeight (10) between top(700) and bottom
      expect(updatedA.top - updatedA.bottom).toBeGreaterThanOrEqual(10);
    });

    it('does not modify staffs on other pages', () => {
      const staffs = [
        makeStaff({ id: 'a', pageIndex: 0, top: 700, bottom: 500 }),
        makeStaff({ id: 'other', pageIndex: 1, top: 600, bottom: 400 }),
      ];
      const pageStaffs = [staffs[0]]; // only page 0 staffs
      const newCanvasY = (PAGE_HEIGHT - 450) * SCALE;

      const result = applySeparatorDrag(
        staffs, 1, newCanvasY, pageStaffs, PAGE_HEIGHT, SCALE, 10,
      );

      const other = result.find(s => s.id === 'other')!;
      expect(other.top).toBe(600);
      expect(other.bottom).toBe(400);
    });
  });

  describe('splitStaffAtPosition', () => {
    it('splits a staff at the specified PDF Y position', () => {
      const staffs = [makeStaff({ id: 'a', top: 700, bottom: 500 })];
      const result = splitStaffAtPosition(staffs, 'a', 600);

      expect(result).toHaveLength(2);
      const upper = result.find(s => s.id === 'a')!;
      expect(upper.top).toBe(700);
      expect(upper.bottom).toBe(600);

      const lower = result.find(s => s.id !== 'a')!;
      expect(lower.top).toBe(600);
      expect(lower.bottom).toBe(500);
    });

    it('clamps to maintain minimum staff height', () => {
      const staffs = [makeStaff({ id: 'a', top: 700, bottom: 500 })];
      // Try to split very close to the top
      const result = splitStaffAtPosition(staffs, 'a', 695);

      const upper = result.find(s => s.id === 'a')!;
      expect(upper.top - upper.bottom).toBeGreaterThanOrEqual(10);
      const lower = result.find(s => s.id !== 'a')!;
      expect(lower.top - lower.bottom).toBeGreaterThanOrEqual(10);
    });

    it('clamps to maintain minimum staff height (near bottom)', () => {
      const staffs = [makeStaff({ id: 'a', top: 700, bottom: 500 })];
      const result = splitStaffAtPosition(staffs, 'a', 505);

      const upper = result.find(s => s.id === 'a')!;
      expect(upper.top - upper.bottom).toBeGreaterThanOrEqual(10);
      const lower = result.find(s => s.id !== 'a')!;
      expect(lower.top - lower.bottom).toBeGreaterThanOrEqual(10);
    });

    it('preserves systemIndex, pageIndex, and label', () => {
      const staffs = [makeStaff({ id: 'a', top: 700, bottom: 500, pageIndex: 2, systemIndex: 1, label: 'Violin I' })];
      const result = splitStaffAtPosition(staffs, 'a', 600);

      for (const s of result) {
        expect(s.pageIndex).toBe(2);
        expect(s.systemIndex).toBe(1);
        expect(s.label).toBe('Violin I');
      }
    });

    it('returns staffs unchanged when staffId not found', () => {
      const staffs = [makeStaff({ id: 'a', top: 700, bottom: 500 })];
      const result = splitStaffAtPosition(staffs, 'nonexistent', 600);
      expect(result).toEqual(staffs);
    });

    it('inserts new staff right after the split staff', () => {
      const staffs = [
        makeStaff({ id: 'a', top: 700, bottom: 500 }),
        makeStaff({ id: 'b', top: 400, bottom: 200 }),
      ];
      const result = splitStaffAtPosition(staffs, 'a', 600);

      expect(result).toHaveLength(3);
      expect(result[0].id).toBe('a');
      expect(result[2].id).toBe('b');
    });
  });

  describe('addStaffAtPosition', () => {
    it('creates a new staff centered at the given PDF Y', () => {
      const result = addStaffAtPosition([], 0, 400, PAGE_HEIGHT);

      expect(result).toHaveLength(1);
      expect(result[0].pageIndex).toBe(0);
      expect(result[0].top).toBe(425);
      expect(result[0].bottom).toBe(375);
      expect(result[0].label).toBe('');
      expect(result[0].systemIndex).toBe(0);
    });

    it('clamps to page bounds (near top)', () => {
      const result = addStaffAtPosition([], 0, PAGE_HEIGHT - 10, PAGE_HEIGHT);

      expect(result[0].top).toBe(PAGE_HEIGHT);
      expect(result[0].bottom).toBe(PAGE_HEIGHT - 50);
    });

    it('clamps to page bounds (near bottom)', () => {
      const result = addStaffAtPosition([], 0, 10, PAGE_HEIGHT);

      expect(result[0].top).toBe(50);
      expect(result[0].bottom).toBe(0);
    });

    it('appends to existing staffs', () => {
      const staffs = [makeStaff({ id: 'a', top: 700, bottom: 600 })];
      const result = addStaffAtPosition(staffs, 0, 400, PAGE_HEIGHT);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('a');
    });

    it('uses the correct pageIndex', () => {
      const result = addStaffAtPosition([], 3, 400, PAGE_HEIGHT);
      expect(result[0].pageIndex).toBe(3);
    });

    it('infers systemIndex from nearest staff above on the same page', () => {
      const staffs = [
        makeStaff({ id: 'a', pageIndex: 0, top: 700, bottom: 600, systemIndex: 0 }),
        makeStaff({ id: 'b', pageIndex: 0, top: 400, bottom: 300, systemIndex: 1 }),
      ];
      // Add at pdfY=350, between b's top(400) and bottom(300) → nearest is b (system 1)
      const result = addStaffAtPosition(staffs, 0, 250, PAGE_HEIGHT);
      const added = result.find(s => s.id !== 'a' && s.id !== 'b')!;
      expect(added.systemIndex).toBe(1);
    });

    it('infers systemIndex from nearest staff below when above the first staff', () => {
      const staffs = [
        makeStaff({ id: 'a', pageIndex: 0, top: 500, bottom: 400, systemIndex: 2 }),
      ];
      // Add above existing staff
      const result = addStaffAtPosition(staffs, 0, 700, PAGE_HEIGHT);
      const added = result.find(s => s.id !== 'a')!;
      expect(added.systemIndex).toBe(2);
    });

    it('defaults to systemIndex 0 when no staffs on the same page', () => {
      const staffs = [
        makeStaff({ id: 'a', pageIndex: 1, top: 700, bottom: 600, systemIndex: 3 }),
      ];
      const result = addStaffAtPosition(staffs, 0, 400, PAGE_HEIGHT);
      const added = result.find(s => s.id !== 'a')!;
      expect(added.systemIndex).toBe(0);
    });
  });

  describe('mergeSeparator', () => {
    it('merges two adjacent staffs into one', () => {
      const staffs = [
        makeStaff({ id: 'a', top: 700, bottom: 600, systemIndex: 0 }),
        makeStaff({ id: 'b', top: 600, bottom: 500, systemIndex: 0 }),
      ];
      const result = mergeSeparator(staffs, 'a', 'b');

      expect(result).toHaveLength(1);
      const merged = result[0];
      expect(merged.id).toBe('a');
      expect(merged.top).toBe(700);
      expect(merged.bottom).toBe(500);
    });

    it('preserves the upper staff label and systemIndex', () => {
      const staffs = [
        makeStaff({ id: 'a', top: 700, bottom: 600, label: 'Violin I', systemIndex: 0 }),
        makeStaff({ id: 'b', top: 600, bottom: 500, label: 'Viola', systemIndex: 0 }),
      ];
      const result = mergeSeparator(staffs, 'a', 'b');

      expect(result[0].label).toBe('Violin I');
      expect(result[0].systemIndex).toBe(0);
    });

    it('does not modify other staffs', () => {
      const staffs = [
        makeStaff({ id: 'a', top: 700, bottom: 600 }),
        makeStaff({ id: 'b', top: 600, bottom: 500 }),
        makeStaff({ id: 'c', top: 400, bottom: 300 }),
      ];
      const result = mergeSeparator(staffs, 'a', 'b');

      expect(result).toHaveLength(2);
      const c = result.find(s => s.id === 'c')!;
      expect(c.top).toBe(400);
      expect(c.bottom).toBe(300);
    });

    it('returns staffs unchanged when staffAboveId not found', () => {
      const staffs = [makeStaff({ id: 'a', top: 700, bottom: 500 })];
      const result = mergeSeparator(staffs, 'nonexistent', 'a');
      expect(result).toEqual(staffs);
    });

    it('returns staffs unchanged when staffBelowId not found', () => {
      const staffs = [makeStaff({ id: 'a', top: 700, bottom: 500 })];
      const result = mergeSeparator(staffs, 'a', 'nonexistent');
      expect(result).toEqual(staffs);
    });

    it('works across system boundaries', () => {
      const staffs = [
        makeStaff({ id: 'a', top: 700, bottom: 600, systemIndex: 0 }),
        makeStaff({ id: 'b', top: 500, bottom: 400, systemIndex: 1 }),
      ];
      const result = mergeSeparator(staffs, 'a', 'b');

      expect(result).toHaveLength(1);
      expect(result[0].top).toBe(700);
      expect(result[0].bottom).toBe(400);
      expect(result[0].systemIndex).toBe(0);
    });
  });

  describe('splitSystemAtPosition', () => {
    it('returns unchanged when no staffs exist on the page', () => {
      const staffs = [makeStaff({ id: 'a', pageIndex: 1, top: 700, bottom: 600, systemIndex: 0 })];
      const result = splitSystemAtPosition(staffs, 0, 650);
      expect(result).toEqual(staffs);
    });

    it('returns unchanged when pdfY is outside all systems', () => {
      const staffs = [makeStaff({ id: 'a', top: 700, bottom: 600, systemIndex: 0 })];
      // pdfY=100 is below all staffs (bottom=600)
      const result = splitSystemAtPosition(staffs, 0, 100);
      expect(result).toEqual(staffs);
    });

    it('splits at a gap between two staffs in the same system', () => {
      const staffs = [
        makeStaff({ id: 'a', top: 700, bottom: 600, systemIndex: 0 }),
        makeStaff({ id: 'b', top: 500, bottom: 400, systemIndex: 0 }),
      ];
      // pdfY=550 is in the gap: a.bottom=600, b.top=500
      const result = splitSystemAtPosition(staffs, 0, 550);
      expect(result).toHaveLength(2);
      expect(result.find(s => s.id === 'a')!.systemIndex).toBe(0);
      expect(result.find(s => s.id === 'b')!.systemIndex).toBe(1);
    });

    it('splits inside a staff region by splitting the staff first', () => {
      const staffs = [
        makeStaff({ id: 'a', top: 700, bottom: 600, systemIndex: 0 }),
        makeStaff({ id: 'b', top: 600, bottom: 400, systemIndex: 0 }),
      ];
      // pdfY=500 is inside staff b (top=600, bottom=400)
      const result = splitSystemAtPosition(staffs, 0, 500);
      // Staff a stays in system 0
      expect(result.find(s => s.id === 'a')!.systemIndex).toBe(0);
      // Staff b (upper half, keeps id 'b') stays in system 0
      const upper = result.find(s => s.id === 'b')!;
      expect(upper.systemIndex).toBe(0);
      expect(upper.bottom).toBe(500);
      // New lower half goes to system 1
      const lower = result.find(s => s.id !== 'a' && s.id !== 'b')!;
      expect(lower.systemIndex).toBe(1);
      expect(lower.top).toBe(500);
      expect(lower.bottom).toBe(400);
    });

    it('handles single-staff system by splitting staff then system', () => {
      const staffs = [makeStaff({ id: 'a', top: 700, bottom: 400, systemIndex: 0 })];
      const result = splitSystemAtPosition(staffs, 0, 550);
      expect(result).toHaveLength(2);
      const upper = result.find(s => s.id === 'a')!;
      expect(upper.systemIndex).toBe(0);
      expect(upper.bottom).toBe(550);
      const lower = result.find(s => s.id !== 'a')!;
      expect(lower.systemIndex).toBe(1);
      expect(lower.top).toBe(550);
    });

    it('increments systemIndex of subsequent systems', () => {
      const staffs = [
        makeStaff({ id: 'a', top: 700, bottom: 600, systemIndex: 0 }),
        makeStaff({ id: 'b', top: 500, bottom: 400, systemIndex: 0 }),
        makeStaff({ id: 'c', top: 300, bottom: 200, systemIndex: 1 }),
      ];
      const result = splitSystemAtPosition(staffs, 0, 550);
      expect(result.find(s => s.id === 'a')!.systemIndex).toBe(0);
      expect(result.find(s => s.id === 'b')!.systemIndex).toBe(1);
      expect(result.find(s => s.id === 'c')!.systemIndex).toBe(2);
    });

    it('does not affect staffs on other pages', () => {
      const staffs = [
        makeStaff({ id: 'a', pageIndex: 0, top: 700, bottom: 600, systemIndex: 0 }),
        makeStaff({ id: 'b', pageIndex: 0, top: 500, bottom: 400, systemIndex: 0 }),
        makeStaff({ id: 'c', pageIndex: 1, top: 700, bottom: 600, systemIndex: 0 }),
      ];
      const result = splitSystemAtPosition(staffs, 0, 550);
      expect(result.find(s => s.id === 'c')!.systemIndex).toBe(0);
    });

    it('treats click near staff boundary as gap split (no staff split)', () => {
      const staffs = [
        makeStaff({ id: 'a', top: 700, bottom: 600, systemIndex: 0 }),
        makeStaff({ id: 'b', top: 600, bottom: 400, systemIndex: 0 }),
      ];
      // pdfY=605 is inside staff a but within MIN_SPLIT_HEIGHT(10) of boundary with b at 600
      const result = splitSystemAtPosition(staffs, 0, 605);
      // Should NOT split staff a, should split system at the gap between a and b
      expect(result).toHaveLength(2);
      expect(result.find(s => s.id === 'a')!.systemIndex).toBe(0);
      expect(result.find(s => s.id === 'b')!.systemIndex).toBe(1);
    });

    it('splits inside middle staff of a three-staff system', () => {
      const staffs = [
        makeStaff({ id: 'a', top: 700, bottom: 600, systemIndex: 0 }),
        makeStaff({ id: 'b', top: 600, bottom: 400, systemIndex: 0 }),
        makeStaff({ id: 'c', top: 400, bottom: 300, systemIndex: 0 }),
      ];
      // pdfY=500 is in the middle of staff b
      const result = splitSystemAtPosition(staffs, 0, 500);
      // a and upper-b stay in system 0
      expect(result.find(s => s.id === 'a')!.systemIndex).toBe(0);
      expect(result.find(s => s.id === 'b')!.systemIndex).toBe(0);
      // lower-b and c move to system 1
      const lowerB = result.find(s => s.id !== 'a' && s.id !== 'b' && s.id !== 'c')!;
      expect(lowerB.systemIndex).toBe(1);
      expect(result.find(s => s.id === 'c')!.systemIndex).toBe(1);
    });
  });
});
