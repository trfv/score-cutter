import { describe, it, expect } from 'vitest';
import type { Staff } from '../staffModel';
import {
  computeSeparators,
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

    it('returns part separator between staffs regardless of systemIndex', () => {
      const staffs = [
        makeStaff({ id: 'a', top: 700, bottom: 500, systemIndex: 0 }),
        makeStaff({ id: 'b', top: 400, bottom: 200, systemIndex: 1 }),
      ];
      const result = computeSeparators(staffs, PAGE_HEIGHT, SCALE);

      expect(result.separators).toHaveLength(3);
      expect(result.separators[1].kind).toBe('part');
      expect(result.separators[1].staffAboveId).toBe('a');
      expect(result.separators[1].staffBelowId).toBe('b');
    });

    it('handles 3 staffs across different systems as all part separators', () => {
      const staffs = [
        makeStaff({ id: 'a', top: 700, bottom: 600, systemIndex: 0 }),
        makeStaff({ id: 'b', top: 600, bottom: 500, systemIndex: 0 }),
        makeStaff({ id: 'c', top: 400, bottom: 300, systemIndex: 1 }),
      ];
      const result = computeSeparators(staffs, PAGE_HEIGHT, SCALE);

      expect(result.separators).toHaveLength(4);
      expect(result.separators[0].kind).toBe('edge');   // top of a
      expect(result.separators[1].kind).toBe('part');    // between a and b
      expect(result.separators[2].kind).toBe('part');    // between b and c
      expect(result.separators[3].kind).toBe('edge');    // bottom of c
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
});
