import { describe, it, expect } from 'vitest';
import type { Staff, System } from '../staffModel';
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
    systemId: 'sys-0',
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
        makeStaff({ id: 'a', top: 700, bottom: 500, systemId: 'sys-0' }),
        makeStaff({ id: 'b', top: 500, bottom: 300, systemId: 'sys-0' }),
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
        makeStaff({ id: 'a', top: 700, bottom: 500, systemId: 'sys-0' }),
        makeStaff({ id: 'b', top: 400, bottom: 200, systemId: 'sys-1' }),
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
        makeStaff({ id: 'a', top: 700, bottom: 600, systemId: 'sys-0' }),
        makeStaff({ id: 'b', top: 600, bottom: 500, systemId: 'sys-0' }),
        makeStaff({ id: 'c', top: 400, bottom: 300, systemId: 'sys-1' }),
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
        makeStaff({ id: 'c', top: 300, bottom: 200, systemId: 'sys-1' }),
        makeStaff({ id: 'a', top: 700, bottom: 600, systemId: 'sys-0' }),
        makeStaff({ id: 'b', top: 500, bottom: 400, systemId: 'sys-0' }),
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
        makeStaff({ id: 'a', top: 700, bottom: 600, systemId: 'sys-0' }),
        makeStaff({ id: 'b', top: 600, bottom: 500, systemId: 'sys-0' }),
      ];
      const result = computeSystemGroups(staffs, PAGE_HEIGHT, SCALE);

      expect(result).toHaveLength(1);
      expect(result[0].ordinal).toBe(0);
      expect(result[0].separators).toHaveLength(3); // edge, part, edge
      expect(result[0].regions).toHaveLength(2);
    });

    it('returns separate groups for different systemId', () => {
      const staffs = [
        makeStaff({ id: 'a', top: 700, bottom: 600, systemId: 'sys-0' }),
        makeStaff({ id: 'b', top: 600, bottom: 500, systemId: 'sys-0' }),
        makeStaff({ id: 'c', top: 400, bottom: 300, systemId: 'sys-1' }),
      ];
      const result = computeSystemGroups(staffs, PAGE_HEIGHT, SCALE);

      expect(result).toHaveLength(2);

      // System 0
      expect(result[0].ordinal).toBe(0);
      expect(result[0].regions).toHaveLength(2);
      expect(result[0].separators).toHaveLength(3); // edge, part, edge

      // System 1
      expect(result[1].ordinal).toBe(1);
      expect(result[1].regions).toHaveLength(1);
      expect(result[1].separators).toHaveLength(2); // edge, edge
    });

    it('computes correct topCanvasY and bottomCanvasY for each group', () => {
      const staffs = [
        makeStaff({ id: 'a', top: 700, bottom: 600, systemId: 'sys-0' }),
        makeStaff({ id: 'b', top: 400, bottom: 300, systemId: 'sys-1' }),
      ];
      const result = computeSystemGroups(staffs, PAGE_HEIGHT, SCALE);

      // System 0: top of staff a → bottom of staff a
      expect(result[0].topCanvasY).toBeCloseTo((PAGE_HEIGHT - 700) * SCALE, 5);
      expect(result[0].bottomCanvasY).toBeCloseTo((PAGE_HEIGHT - 600) * SCALE, 5);

      // System 1: top of staff b → bottom of staff b
      expect(result[1].topCanvasY).toBeCloseTo((PAGE_HEIGHT - 400) * SCALE, 5);
      expect(result[1].bottomCanvasY).toBeCloseTo((PAGE_HEIGHT - 300) * SCALE, 5);
    });

    it('groups are sorted by top position (visual order)', () => {
      const staffs = [
        makeStaff({ id: 'c', top: 300, bottom: 200, systemId: 'sys-1' }),
        makeStaff({ id: 'a', top: 700, bottom: 600, systemId: 'sys-0' }),
      ];
      const result = computeSystemGroups(staffs, PAGE_HEIGHT, SCALE);

      expect(result[0].ordinal).toBe(0);
      expect(result[1].ordinal).toBe(1);
    });

    it('handles a single staff as one group', () => {
      const staffs = [makeStaff({ id: 'a', top: 600, bottom: 400 })];
      const result = computeSystemGroups(staffs, PAGE_HEIGHT, SCALE);

      expect(result).toHaveLength(1);
      expect(result[0].ordinal).toBe(0);
      expect(result[0].separators).toHaveLength(2); // edge, edge
      expect(result[0].regions).toHaveLength(1);
    });

    it('includes systemId on groups derived from staff systemId (no pageSystems)', () => {
      const staffs = [
        makeStaff({ id: 'a', top: 700, bottom: 600, systemId: 'sys-A' }),
        makeStaff({ id: 'b', top: 400, bottom: 300, systemId: 'sys-B' }),
      ];
      const result = computeSystemGroups(staffs, PAGE_HEIGHT, SCALE);

      expect(result[0].systemId).toBe('sys-A');
      expect(result[1].systemId).toBe('sys-B');
    });

    it('includes systemId on regions', () => {
      const staffs = [
        makeStaff({ id: 'a', top: 700, bottom: 600, systemId: 'sys-A' }),
      ];
      const result = computeSystemGroups(staffs, PAGE_HEIGHT, SCALE);

      expect(result[0].regions[0].systemId).toBe('sys-A');
    });

    it('groups by systemId when pageSystems is provided', () => {
      const systems: System[] = [
        { id: 'sys-A', pageIndex: 0, top: 750, bottom: 550 },
        { id: 'sys-B', pageIndex: 0, top: 450, bottom: 250 },
      ];
      const staffs = [
        makeStaff({ id: 'a', top: 700, bottom: 600, systemId: 'sys-A' }),
        makeStaff({ id: 'b', top: 650, bottom: 560, systemId: 'sys-A' }),
        makeStaff({ id: 'c', top: 400, bottom: 300, systemId: 'sys-B' }),
      ];
      const result = computeSystemGroups(staffs, PAGE_HEIGHT, SCALE, systems);

      expect(result).toHaveLength(2);
      expect(result[0].systemId).toBe('sys-A');
      expect(result[0].regions).toHaveLength(2);
      expect(result[1].systemId).toBe('sys-B');
      expect(result[1].regions).toHaveLength(1);
    });

    it('uses System boundaries for group bounds when pageSystems provided', () => {
      const systems: System[] = [
        { id: 'sys-A', pageIndex: 0, top: 750, bottom: 550 },
      ];
      const staffs = [
        makeStaff({ id: 'a', top: 700, bottom: 600, systemId: 'sys-A' }),
      ];
      const result = computeSystemGroups(staffs, PAGE_HEIGHT, SCALE, systems);

      // Group bounds come from System (750, 550), not from staff (700, 600)
      expect(result[0].topCanvasY).toBeCloseTo((PAGE_HEIGHT - 750) * SCALE, 5);
      expect(result[0].bottomCanvasY).toBeCloseTo((PAGE_HEIGHT - 550) * SCALE, 5);
    });

    it('includes empty Systems as groups with no regions/separators', () => {
      const systems: System[] = [
        { id: 'sys-A', pageIndex: 0, top: 750, bottom: 550 },
        { id: 'sys-B', pageIndex: 0, top: 450, bottom: 250 },
      ];
      const staffs = [
        makeStaff({ id: 'a', top: 700, bottom: 600, systemId: 'sys-A' }),
      ];
      // sys-B has no staffs
      const result = computeSystemGroups(staffs, PAGE_HEIGHT, SCALE, systems);

      expect(result).toHaveLength(2);
      expect(result[0].systemId).toBe('sys-A');
      expect(result[0].regions).toHaveLength(1);
      expect(result[1].systemId).toBe('sys-B');
      expect(result[1].regions).toHaveLength(0);
      expect(result[1].separators).toHaveLength(0);
    });

    it('sorts groups by System top descending when pageSystems provided', () => {
      const systems: System[] = [
        { id: 'sys-B', pageIndex: 0, top: 400, bottom: 200 },
        { id: 'sys-A', pageIndex: 0, top: 800, bottom: 600 },
      ];
      const staffs = [
        makeStaff({ id: 'a', top: 750, bottom: 650, systemId: 'sys-A' }),
        makeStaff({ id: 'b', top: 350, bottom: 250, systemId: 'sys-B' }),
      ];
      const result = computeSystemGroups(staffs, PAGE_HEIGHT, SCALE, systems);

      // sys-A (top=800) should be first
      expect(result[0].systemId).toBe('sys-A');
      expect(result[1].systemId).toBe('sys-B');
    });
  });

  describe('splitSystemAtGap', () => {
    describe('with systems', () => {
      it('creates a new System for the lower portion', () => {
        const systems: System[] = [
          { id: 'sys-0', pageIndex: 0, top: 750, bottom: 350 },
        ];
        const staffs = [
          makeStaff({ id: 'a', top: 700, bottom: 600, systemId: 'sys-0' }),
          makeStaff({ id: 'b', top: 500, bottom: 400, systemId: 'sys-0' }),
        ];
        const result = splitSystemAtGap(staffs, 'a', 'b', systems);

        expect(result.systems).toHaveLength(2);
        const originalSys = result.systems.find(sys => sys.id === 'sys-0')!;
        expect(originalSys.bottom).toBe(550); // (600 + 500) / 2
        const newSys = result.systems.find(sys => sys.id !== 'sys-0')!;
        expect(newSys.top).toBe(550);
        expect(newSys.bottom).toBe(350);
        expect(newSys.pageIndex).toBe(0);
      });

      it('reassigns systemId on lower staffs', () => {
        const systems: System[] = [
          { id: 'sys-0', pageIndex: 0, top: 750, bottom: 350 },
        ];
        const staffs = [
          makeStaff({ id: 'a', top: 700, bottom: 600, systemId: 'sys-0' }),
          makeStaff({ id: 'b', top: 500, bottom: 400, systemId: 'sys-0' }),
        ];
        const result = splitSystemAtGap(staffs, 'a', 'b', systems);

        const staffA = result.staffs.find(s => s.id === 'a')!;
        const staffB = result.staffs.find(s => s.id === 'b')!;
        expect(staffA.systemId).toBe('sys-0');
        expect(staffB.systemId).not.toBe('sys-0');
        const newSys = result.systems.find(sys => sys.id !== 'sys-0')!;
        expect(staffB.systemId).toBe(newSys.id);
      });

      it('splits system with three staffs and reassigns lower two', () => {
        const systems: System[] = [
          { id: 'sys-0', pageIndex: 0, top: 750, bottom: 150 },
        ];
        const staffs = [
          makeStaff({ id: 'a', top: 700, bottom: 600, systemId: 'sys-0' }),
          makeStaff({ id: 'b', top: 500, bottom: 400, systemId: 'sys-0' }),
          makeStaff({ id: 'c', top: 300, bottom: 200, systemId: 'sys-0' }),
        ];
        const result = splitSystemAtGap(staffs, 'a', 'b', systems);

        const staffA = result.staffs.find(s => s.id === 'a')!;
        const staffB = result.staffs.find(s => s.id === 'b')!;
        const staffC = result.staffs.find(s => s.id === 'c')!;
        expect(staffA.systemId).toBe('sys-0');
        // b and c should be in the new system
        expect(staffB.systemId).not.toBe('sys-0');
        expect(staffC.systemId).toBe(staffB.systemId);
      });

      it('shifts subsequent systems when splitting', () => {
        const systems: System[] = [
          { id: 'sys-0', pageIndex: 0, top: 750, bottom: 350 },
          { id: 'sys-1', pageIndex: 0, top: 250, bottom: 50 },
        ];
        const staffs = [
          makeStaff({ id: 'a', top: 700, bottom: 600, systemId: 'sys-0' }),
          makeStaff({ id: 'b', top: 500, bottom: 400, systemId: 'sys-0' }),
          makeStaff({ id: 'c', top: 200, bottom: 100, systemId: 'sys-1' }),
        ];
        const result = splitSystemAtGap(staffs, 'a', 'b', systems);

        expect(result.systems).toHaveLength(3);
        // sys-1 should be preserved
        const sys1 = result.systems.find(sys => sys.id === 'sys-1')!;
        expect(sys1).toBeDefined();
        // staff c remains in sys-1
        expect(result.staffs.find(s => s.id === 'c')!.systemId).toBe('sys-1');
      });

      it('returns unchanged if staffAboveId not found', () => {
        const systems: System[] = [
          { id: 'sys-0', pageIndex: 0, top: 750, bottom: 350 },
        ];
        const staffs = [makeStaff({ id: 'a', top: 700, bottom: 600, systemId: 'sys-0' })];
        const { staffs: result } = splitSystemAtGap(staffs, 'nonexistent', 'a', systems);
        expect(result).toEqual(staffs);
      });

      it('returns unchanged if staffs are in different systems', () => {
        const systems: System[] = [
          { id: 'sys-0', pageIndex: 0, top: 750, bottom: 550 },
          { id: 'sys-1', pageIndex: 0, top: 450, bottom: 250 },
        ];
        const staffs = [
          makeStaff({ id: 'a', top: 700, bottom: 600, systemId: 'sys-0' }),
          makeStaff({ id: 'b', top: 400, bottom: 300, systemId: 'sys-1' }),
        ];
        const { staffs: result } = splitSystemAtGap(staffs, 'a', 'b', systems);
        expect(result).toEqual(staffs);
      });

      it('does not affect staffs on other pages', () => {
        const systems: System[] = [
          { id: 'sys-0-0', pageIndex: 0, top: 750, bottom: 350 },
          { id: 'sys-1-0', pageIndex: 1, top: 450, bottom: 250 },
          { id: 'sys-1-1', pageIndex: 1, top: 150, bottom: 50 },
        ];
        const staffs = [
          makeStaff({ id: 'a', pageIndex: 0, top: 700, bottom: 600, systemId: 'sys-0-0' }),
          makeStaff({ id: 'b', pageIndex: 0, top: 500, bottom: 400, systemId: 'sys-0-0' }),
          makeStaff({ id: 'c', pageIndex: 1, top: 400, bottom: 300, systemId: 'sys-1-0' }),
          makeStaff({ id: 'd', pageIndex: 1, top: 200, bottom: 100, systemId: 'sys-1-1' }),
        ];
        const result = splitSystemAtGap(staffs, 'a', 'b', systems);

        // Page 0 staffs should be split
        expect(result.staffs.find(s => s.id === 'a')!.systemId).toBe('sys-0-0');
        expect(result.staffs.find(s => s.id === 'b')!.systemId).not.toBe('sys-0-0');
        // Page 1 staffs must remain unchanged
        expect(result.staffs.find(s => s.id === 'c')!.systemId).toBe('sys-1-0');
        expect(result.staffs.find(s => s.id === 'd')!.systemId).toBe('sys-1-1');
      });

      it('preserves systems on other pages', () => {
        const systems: System[] = [
          { id: 'sys-0', pageIndex: 0, top: 750, bottom: 350 },
          { id: 'sys-p1', pageIndex: 1, top: 700, bottom: 200 },
        ];
        const staffs = [
          makeStaff({ id: 'a', pageIndex: 0, top: 700, bottom: 600, systemId: 'sys-0' }),
          makeStaff({ id: 'b', pageIndex: 0, top: 500, bottom: 400, systemId: 'sys-0' }),
        ];
        const result = splitSystemAtGap(staffs, 'a', 'b', systems);

        const page1Sys = result.systems.find(sys => sys.id === 'sys-p1')!;
        expect(page1Sys).toBeDefined();
        expect(page1Sys.top).toBe(700);
        expect(page1Sys.bottom).toBe(200);
      });
    });
  });

  describe('mergeAdjacentSystems', () => {
    describe('with systems', () => {
      it('merges two adjacent systems into one', () => {
        const systems: System[] = [
          { id: 'sys-0', pageIndex: 0, top: 750, bottom: 550 },
          { id: 'sys-1', pageIndex: 0, top: 450, bottom: 250 },
        ];
        const staffs = [
          makeStaff({ id: 'a', top: 700, bottom: 600, systemId: 'sys-0' }),
          makeStaff({ id: 'b', top: 400, bottom: 300, systemId: 'sys-1' }),
        ];
        const result = mergeAdjacentSystems(staffs, 0, 0, systems);

        expect(result.staffs.find(s => s.id === 'a')!.systemId).toBe('sys-0');
        expect(result.staffs.find(s => s.id === 'b')!.systemId).toBe('sys-0');
      });

      it('merges two Systems (upper absorbs lower)', () => {
        const systems: System[] = [
          { id: 'sys-0', pageIndex: 0, top: 750, bottom: 550 },
          { id: 'sys-1', pageIndex: 0, top: 450, bottom: 250 },
        ];
        const staffs = [
          makeStaff({ id: 'a', top: 700, bottom: 600, systemId: 'sys-0' }),
          makeStaff({ id: 'b', top: 400, bottom: 300, systemId: 'sys-1' }),
        ];
        const result = mergeAdjacentSystems(staffs, 0, 0, systems);

        expect(result.systems).toHaveLength(1);
        const merged = result.systems[0];
        expect(merged.id).toBe('sys-0');
        expect(merged.top).toBe(750);
        expect(merged.bottom).toBe(250);
      });

      it('reassigns lower staffs systemId to upper system', () => {
        const systems: System[] = [
          { id: 'sys-0', pageIndex: 0, top: 750, bottom: 550 },
          { id: 'sys-1', pageIndex: 0, top: 450, bottom: 250 },
        ];
        const staffs = [
          makeStaff({ id: 'a', top: 700, bottom: 600, systemId: 'sys-0' }),
          makeStaff({ id: 'b', top: 400, bottom: 300, systemId: 'sys-1' }),
        ];
        const result = mergeAdjacentSystems(staffs, 0, 0, systems);

        expect(result.staffs.find(s => s.id === 'a')!.systemId).toBe('sys-0');
        expect(result.staffs.find(s => s.id === 'b')!.systemId).toBe('sys-0');
      });

      it('decrements subsequent systems after merge', () => {
        const systems: System[] = [
          { id: 'sys-0', pageIndex: 0, top: 750, bottom: 550 },
          { id: 'sys-1', pageIndex: 0, top: 450, bottom: 350 },
          { id: 'sys-2', pageIndex: 0, top: 250, bottom: 50 },
        ];
        const staffs = [
          makeStaff({ id: 'a', top: 700, bottom: 600, systemId: 'sys-0' }),
          makeStaff({ id: 'b', top: 400, bottom: 360, systemId: 'sys-1' }),
          makeStaff({ id: 'c', top: 200, bottom: 100, systemId: 'sys-2' }),
        ];
        const result = mergeAdjacentSystems(staffs, 0, 0, systems);

        // sys-0 and sys-1 merged, sys-2 still exists
        expect(result.systems).toHaveLength(2);
        expect(result.staffs.find(s => s.id === 'a')!.systemId).toBe('sys-0');
        expect(result.staffs.find(s => s.id === 'b')!.systemId).toBe('sys-0');
        expect(result.staffs.find(s => s.id === 'c')!.systemId).toBe('sys-2');
      });

      it('only affects staffs on the specified page', () => {
        const systems: System[] = [
          { id: 'sys-0', pageIndex: 0, top: 750, bottom: 550 },
          { id: 'sys-1', pageIndex: 0, top: 450, bottom: 250 },
          { id: 'sys-p1', pageIndex: 1, top: 750, bottom: 550 },
        ];
        const staffs = [
          makeStaff({ id: 'a', pageIndex: 0, top: 700, bottom: 600, systemId: 'sys-0' }),
          makeStaff({ id: 'b', pageIndex: 0, top: 400, bottom: 300, systemId: 'sys-1' }),
          makeStaff({ id: 'c', pageIndex: 1, top: 700, bottom: 600, systemId: 'sys-p1' }),
        ];
        const result = mergeAdjacentSystems(staffs, 0, 0, systems);

        expect(result.staffs.find(s => s.id === 'b')!.systemId).toBe('sys-0');
        // Page 1 staff should be unchanged
        expect(result.staffs.find(s => s.id === 'c')!.systemId).toBe('sys-p1');
      });

      it('returns unchanged if upperSystemIndex has no staffs', () => {
        const systems: System[] = [
          { id: 'sys-0', pageIndex: 0, top: 750, bottom: 550 },
        ];
        const staffs = [
          makeStaff({ id: 'a', top: 700, bottom: 600, systemId: 'sys-0' }),
        ];
        const { staffs: result } = mergeAdjacentSystems(staffs, 0, 5, systems);
        expect(result).toEqual(staffs);
      });
    });
  });

  describe('reassignStaffsByDrag', () => {
    describe('with systems', () => {
      it('moves a staff to the upper system when dragged below its center', () => {
        const systems: System[] = [
          { id: 'sys-0', pageIndex: 0, top: 750, bottom: 550 },
          { id: 'sys-1', pageIndex: 0, top: 450, bottom: 250 },
        ];
        const staffs = [
          makeStaff({ id: 'a', top: 700, bottom: 600, systemId: 'sys-0' }),
          makeStaff({ id: 'b', top: 400, bottom: 300, systemId: 'sys-1' }),
        ];
        // newCanvasY below b's center (canvas Y > center canvas Y means lower on screen)
        const bCenterCanvasY = (PAGE_HEIGHT - 350) * SCALE;
        const newCanvasY = bCenterCanvasY + 10;

        const result = reassignStaffsByDrag(
          staffs, 0, 0, newCanvasY, PAGE_HEIGHT, SCALE, systems,
        );

        expect(result.staffs.find(s => s.id === 'a')!.systemId).toBe('sys-0');
        expect(result.staffs.find(s => s.id === 'b')!.systemId).toBe('sys-0');
      });

      it('moves a staff to the lower system when dragged above its center', () => {
        const systems: System[] = [
          { id: 'sys-0', pageIndex: 0, top: 750, bottom: 350 },
          { id: 'sys-1', pageIndex: 0, top: 250, bottom: 50 },
        ];
        const staffs = [
          makeStaff({ id: 'a', top: 700, bottom: 600, systemId: 'sys-0' }),
          makeStaff({ id: 'b', top: 500, bottom: 400, systemId: 'sys-0' }),
          makeStaff({ id: 'c', top: 200, bottom: 100, systemId: 'sys-1' }),
        ];
        // Drag the separator between system 0 and system 1 (systemSepIndex=0)
        // to above staff b's center
        const bCenterCanvasY = (PAGE_HEIGHT - 450) * SCALE;
        const newCanvasY = bCenterCanvasY - 10;

        const result = reassignStaffsByDrag(
          staffs, 0, 0, newCanvasY, PAGE_HEIGHT, SCALE, systems,
        );

        expect(result.staffs.find(s => s.id === 'a')!.systemId).toBe('sys-0');
        expect(result.staffs.find(s => s.id === 'b')!.systemId).toBe('sys-1');
        expect(result.staffs.find(s => s.id === 'c')!.systemId).toBe('sys-1');
      });

      it('does nothing when drag stays between the same staffs', () => {
        const systems: System[] = [
          { id: 'sys-0', pageIndex: 0, top: 750, bottom: 550 },
          { id: 'sys-1', pageIndex: 0, top: 450, bottom: 250 },
        ];
        const staffs = [
          makeStaff({ id: 'a', top: 700, bottom: 600, systemId: 'sys-0' }),
          makeStaff({ id: 'b', top: 400, bottom: 300, systemId: 'sys-1' }),
        ];
        // Drag to midpoint between systems (no staff centers crossed)
        const midCanvasY = (PAGE_HEIGHT - 500) * SCALE;

        const result = reassignStaffsByDrag(
          staffs, 0, 0, midCanvasY, PAGE_HEIGHT, SCALE, systems,
        );

        expect(result.staffs.find(s => s.id === 'a')!.systemId).toBe('sys-0');
        expect(result.staffs.find(s => s.id === 'b')!.systemId).toBe('sys-1');
      });

      it('returns unchanged when systemSepIndex is out of range', () => {
        const systems: System[] = [
          { id: 'sys-0', pageIndex: 0, top: 750, bottom: 550 },
        ];
        const staffs = [
          makeStaff({ id: 'a', top: 700, bottom: 600, systemId: 'sys-0' }),
        ];
        const { staffs: result } = reassignStaffsByDrag(
          staffs, 0, 5, 100, PAGE_HEIGHT, SCALE, systems,
        );
        expect(result).toEqual(staffs);
      });

      it('reassigns staff systemId based on center position relative to drag', () => {
        const systems: System[] = [
          { id: 'sys-0', pageIndex: 0, top: 750, bottom: 550 },
          { id: 'sys-1', pageIndex: 0, top: 450, bottom: 250 },
        ];
        const staffs = [
          makeStaff({ id: 'a', top: 700, bottom: 600, systemId: 'sys-0' }),
          makeStaff({ id: 'b', top: 400, bottom: 300, systemId: 'sys-1' }),
        ];
        // Drag below b's center → b moves to upper system
        const bCenterCanvasY = (PAGE_HEIGHT - 350) * SCALE;
        const newCanvasY = bCenterCanvasY + 10;

        const result = reassignStaffsByDrag(
          staffs, 0, 0, newCanvasY, PAGE_HEIGHT, SCALE, systems,
        );

        expect(result.staffs.find(s => s.id === 'a')!.systemId).toBe('sys-0');
        expect(result.staffs.find(s => s.id === 'b')!.systemId).toBe('sys-0');
      });

      it('updates system boundaries to the drag position', () => {
        const systems: System[] = [
          { id: 'sys-0', pageIndex: 0, top: 750, bottom: 550 },
          { id: 'sys-1', pageIndex: 0, top: 450, bottom: 250 },
        ];
        const staffs = [
          makeStaff({ id: 'a', top: 700, bottom: 600, systemId: 'sys-0' }),
          makeStaff({ id: 'b', top: 400, bottom: 300, systemId: 'sys-1' }),
        ];
        // Drag to midpoint (no staff reassignment, just boundary update)
        const midCanvasY = (PAGE_HEIGHT - 500) * SCALE;

        const result = reassignStaffsByDrag(
          staffs, 0, 0, midCanvasY, PAGE_HEIGHT, SCALE, systems,
        );

        const sys0 = result.systems.find(sys => sys.id === 'sys-0')!;
        const sys1 = result.systems.find(sys => sys.id === 'sys-1')!;
        expect(sys0.bottom).toBeCloseTo(500, 0);
        expect(sys1.top).toBeCloseTo(500, 0);
      });
    });
  });

  describe('applySeparatorDrag', () => {
    it('dragging internal separator updates both adjacent staffs', () => {
      const staffs = [
        makeStaff({ id: 'a', top: 700, bottom: 500, systemId: 'sys-0' }),
        makeStaff({ id: 'b', top: 500, bottom: 300, systemId: 'sys-0' }),
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
        makeStaff({ id: 'a', top: 700, bottom: 500, systemId: 'sys-0' }),
        makeStaff({ id: 'b', top: 500, bottom: 300, systemId: 'sys-0' }),
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
        makeStaff({ id: 'other', pageIndex: 1, top: 600, bottom: 400, systemId: 'sys-p1' }),
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

    it('preserves systemId, pageIndex, and label', () => {
      const staffs = [makeStaff({ id: 'a', top: 700, bottom: 500, pageIndex: 2, systemId: 'sys-1', label: 'Violin I' })];
      const result = splitStaffAtPosition(staffs, 'a', 600);

      for (const s of result) {
        expect(s.pageIndex).toBe(2);
        expect(s.systemId).toBe('sys-1');
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
      const systems: System[] = [];
      const { staffs: result } = addStaffAtPosition([], 0, 400, PAGE_HEIGHT, systems);

      expect(result).toHaveLength(1);
      expect(result[0].pageIndex).toBe(0);
      expect(result[0].top).toBe(425);
      expect(result[0].bottom).toBe(375);
      expect(result[0].label).toBe('');
      expect(result[0].systemId).toBe('');
    });

    it('clamps to page bounds (near top)', () => {
      const systems: System[] = [];
      const { staffs: result } = addStaffAtPosition([], 0, PAGE_HEIGHT - 10, PAGE_HEIGHT, systems);

      expect(result[0].top).toBe(PAGE_HEIGHT);
      expect(result[0].bottom).toBe(PAGE_HEIGHT - 50);
    });

    it('clamps to page bounds (near bottom)', () => {
      const systems: System[] = [];
      const { staffs: result } = addStaffAtPosition([], 0, 10, PAGE_HEIGHT, systems);

      expect(result[0].top).toBe(50);
      expect(result[0].bottom).toBe(0);
    });

    it('appends to existing staffs', () => {
      const staffs = [makeStaff({ id: 'a', top: 700, bottom: 600 })];
      const systems: System[] = [
        { id: 'sys-0', pageIndex: 0, top: 750, bottom: 550 },
      ];
      const { staffs: result } = addStaffAtPosition(staffs, 0, 400, PAGE_HEIGHT, systems);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('a');
    });

    it('uses the correct pageIndex', () => {
      const systems: System[] = [];
      const { staffs: result } = addStaffAtPosition([], 3, 400, PAGE_HEIGHT, systems);
      expect(result[0].pageIndex).toBe(3);
    });

    it('infers systemId from nearest staff above on the same page', () => {
      const staffs = [
        makeStaff({ id: 'a', pageIndex: 0, top: 700, bottom: 600, systemId: 'sys-0' }),
        makeStaff({ id: 'b', pageIndex: 0, top: 400, bottom: 300, systemId: 'sys-1' }),
      ];
      const systems: System[] = [
        { id: 'sys-0', pageIndex: 0, top: 750, bottom: 550 },
        { id: 'sys-1', pageIndex: 0, top: 450, bottom: 250 },
      ];
      // Add at pdfY=250, nearest is b (system 1)
      const { staffs: result } = addStaffAtPosition(staffs, 0, 250, PAGE_HEIGHT, systems);
      const added = result.find(s => s.id !== 'a' && s.id !== 'b')!;
      expect(added.systemId).toBe('sys-1');
    });

    it('infers systemId from nearest staff below when above the first staff', () => {
      const staffs = [
        makeStaff({ id: 'a', pageIndex: 0, top: 500, bottom: 400, systemId: 'sys-2' }),
      ];
      const systems: System[] = [
        { id: 'sys-2', pageIndex: 0, top: 550, bottom: 350 },
      ];
      // Add above existing staff
      const { staffs: result } = addStaffAtPosition(staffs, 0, 700, PAGE_HEIGHT, systems);
      const added = result.find(s => s.id !== 'a')!;
      expect(added.systemId).toBe('sys-2');
    });

    it('defaults to empty systemId when no staffs on the same page', () => {
      const staffs = [
        makeStaff({ id: 'a', pageIndex: 1, top: 700, bottom: 600, systemId: 'sys-3' }),
      ];
      const systems: System[] = [
        { id: 'sys-3', pageIndex: 1, top: 750, bottom: 550 },
      ];
      const { staffs: result } = addStaffAtPosition(staffs, 0, 400, PAGE_HEIGHT, systems);
      const added = result.find(s => s.id !== 'a')!;
      expect(added.systemId).toBe('');
    });

    describe('with systems', () => {
      it('returns systems unchanged', () => {
        const systems: System[] = [
          { id: 'sys-0', pageIndex: 0, top: 750, bottom: 350 },
        ];
        const staffs = [
          makeStaff({ id: 'a', top: 700, bottom: 600, systemId: 'sys-0' }),
        ];
        const result = addStaffAtPosition(staffs, 0, 500, PAGE_HEIGHT, systems);

        expect(result.systems).toEqual(systems);
        expect(result.staffs).toHaveLength(2);
      });
    });
  });

  describe('mergeSeparator', () => {
    it('merges two adjacent staffs into one', () => {
      const staffs = [
        makeStaff({ id: 'a', top: 700, bottom: 600, systemId: 'sys-0' }),
        makeStaff({ id: 'b', top: 600, bottom: 500, systemId: 'sys-0' }),
      ];
      const result = mergeSeparator(staffs, 'a', 'b');

      expect(result).toHaveLength(1);
      const merged = result[0];
      expect(merged.id).toBe('a');
      expect(merged.top).toBe(700);
      expect(merged.bottom).toBe(500);
    });

    it('preserves the upper staff label and systemId', () => {
      const staffs = [
        makeStaff({ id: 'a', top: 700, bottom: 600, label: 'Violin I', systemId: 'sys-0' }),
        makeStaff({ id: 'b', top: 600, bottom: 500, label: 'Viola', systemId: 'sys-0' }),
      ];
      const result = mergeSeparator(staffs, 'a', 'b');

      expect(result[0].label).toBe('Violin I');
      expect(result[0].systemId).toBe('sys-0');
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
        makeStaff({ id: 'a', top: 700, bottom: 600, systemId: 'sys-0' }),
        makeStaff({ id: 'b', top: 500, bottom: 400, systemId: 'sys-1' }),
      ];
      const result = mergeSeparator(staffs, 'a', 'b');

      expect(result).toHaveLength(1);
      expect(result[0].top).toBe(700);
      expect(result[0].bottom).toBe(400);
      expect(result[0].systemId).toBe('sys-0');
    });
  });

  describe('splitSystemAtPosition', () => {
    describe('with systems', () => {
      it('returns unchanged when no staffs exist on the page', () => {
        const systems: System[] = [
          { id: 'sys-0', pageIndex: 1, top: 750, bottom: 550 },
        ];
        const staffs = [makeStaff({ id: 'a', pageIndex: 1, top: 700, bottom: 600, systemId: 'sys-0' })];
        const result = splitSystemAtPosition(staffs, 0, 650, systems);
        expect(result.staffs).toEqual(staffs);
      });

      it('returns unchanged when pdfY is outside all systems', () => {
        const systems: System[] = [
          { id: 'sys-0', pageIndex: 0, top: 750, bottom: 550 },
        ];
        const staffs = [makeStaff({ id: 'a', top: 700, bottom: 600, systemId: 'sys-0' })];
        // pdfY=100 is below all staffs (bottom=600)
        const result = splitSystemAtPosition(staffs, 0, 100, systems);
        expect(result.staffs).toEqual(staffs);
      });

      it('splits at a gap between two staffs in the same system', () => {
        const systems: System[] = [
          { id: 'sys-0', pageIndex: 0, top: 750, bottom: 350 },
        ];
        const staffs = [
          makeStaff({ id: 'a', top: 700, bottom: 600, systemId: 'sys-0' }),
          makeStaff({ id: 'b', top: 500, bottom: 400, systemId: 'sys-0' }),
        ];
        // pdfY=550 is in the gap: a.bottom=600, b.top=500
        const result = splitSystemAtPosition(staffs, 0, 550, systems);
        expect(result.staffs).toHaveLength(2);
        expect(result.staffs.find(s => s.id === 'a')!.systemId).toBe('sys-0');
        expect(result.staffs.find(s => s.id === 'b')!.systemId).not.toBe('sys-0');
      });

      it('splits inside a staff region by splitting the staff first', () => {
        const systems: System[] = [
          { id: 'sys-0', pageIndex: 0, top: 750, bottom: 350 },
        ];
        const staffs = [
          makeStaff({ id: 'a', top: 700, bottom: 600, systemId: 'sys-0' }),
          makeStaff({ id: 'b', top: 600, bottom: 400, systemId: 'sys-0' }),
        ];
        // pdfY=500 is inside staff b (top=600, bottom=400)
        const result = splitSystemAtPosition(staffs, 0, 500, systems);
        // Staff a stays in sys-0
        expect(result.staffs.find(s => s.id === 'a')!.systemId).toBe('sys-0');
        // Staff b (upper half, keeps id 'b') stays in sys-0
        const upper = result.staffs.find(s => s.id === 'b')!;
        expect(upper.systemId).toBe('sys-0');
        expect(upper.bottom).toBe(500);
        // New lower half goes to new system
        const lower = result.staffs.find(s => s.id !== 'a' && s.id !== 'b')!;
        expect(lower.systemId).not.toBe('sys-0');
        expect(lower.top).toBe(500);
        expect(lower.bottom).toBe(400);
      });

      it('handles single-staff system by splitting staff then system', () => {
        const systems: System[] = [
          { id: 'sys-0', pageIndex: 0, top: 750, bottom: 350 },
        ];
        const staffs = [makeStaff({ id: 'a', top: 700, bottom: 400, systemId: 'sys-0' })];
        const result = splitSystemAtPosition(staffs, 0, 550, systems);
        expect(result.staffs).toHaveLength(2);
        const upper = result.staffs.find(s => s.id === 'a')!;
        expect(upper.systemId).toBe('sys-0');
        expect(upper.bottom).toBe(550);
        const lower = result.staffs.find(s => s.id !== 'a')!;
        expect(lower.systemId).not.toBe('sys-0');
        expect(lower.top).toBe(550);
      });

      it('preserves subsequent systems when splitting', () => {
        const systems: System[] = [
          { id: 'sys-0', pageIndex: 0, top: 750, bottom: 350 },
          { id: 'sys-1', pageIndex: 0, top: 250, bottom: 50 },
        ];
        const staffs = [
          makeStaff({ id: 'a', top: 700, bottom: 600, systemId: 'sys-0' }),
          makeStaff({ id: 'b', top: 500, bottom: 400, systemId: 'sys-0' }),
          makeStaff({ id: 'c', top: 200, bottom: 100, systemId: 'sys-1' }),
        ];
        const result = splitSystemAtPosition(staffs, 0, 550, systems);
        expect(result.staffs.find(s => s.id === 'a')!.systemId).toBe('sys-0');
        expect(result.staffs.find(s => s.id === 'b')!.systemId).not.toBe('sys-0');
        // c remains in sys-1
        expect(result.staffs.find(s => s.id === 'c')!.systemId).toBe('sys-1');
      });

      it('does not affect staffs on other pages', () => {
        const systems: System[] = [
          { id: 'sys-0-0', pageIndex: 0, top: 750, bottom: 350 },
          { id: 'sys-1-0', pageIndex: 1, top: 750, bottom: 550 },
        ];
        const staffs = [
          makeStaff({ id: 'a', pageIndex: 0, top: 700, bottom: 600, systemId: 'sys-0-0' }),
          makeStaff({ id: 'b', pageIndex: 0, top: 500, bottom: 400, systemId: 'sys-0-0' }),
          makeStaff({ id: 'c', pageIndex: 1, top: 700, bottom: 600, systemId: 'sys-1-0' }),
        ];
        const result = splitSystemAtPosition(staffs, 0, 550, systems);
        expect(result.staffs.find(s => s.id === 'c')!.systemId).toBe('sys-1-0');
      });

      it('treats click near staff boundary as gap split (no staff split)', () => {
        const systems: System[] = [
          { id: 'sys-0', pageIndex: 0, top: 750, bottom: 350 },
        ];
        const staffs = [
          makeStaff({ id: 'a', top: 700, bottom: 600, systemId: 'sys-0' }),
          makeStaff({ id: 'b', top: 600, bottom: 400, systemId: 'sys-0' }),
        ];
        // pdfY=605 is inside staff a but within MIN_SPLIT_HEIGHT(10) of boundary with b at 600
        const result = splitSystemAtPosition(staffs, 0, 605, systems);
        // Should NOT split staff a, should split system at the gap between a and b
        expect(result.staffs).toHaveLength(2);
        expect(result.staffs.find(s => s.id === 'a')!.systemId).toBe('sys-0');
        expect(result.staffs.find(s => s.id === 'b')!.systemId).not.toBe('sys-0');
      });

      it('splits inside middle staff of a three-staff system', () => {
        const systems: System[] = [
          { id: 'sys-0', pageIndex: 0, top: 750, bottom: 250 },
        ];
        const staffs = [
          makeStaff({ id: 'a', top: 700, bottom: 600, systemId: 'sys-0' }),
          makeStaff({ id: 'b', top: 600, bottom: 400, systemId: 'sys-0' }),
          makeStaff({ id: 'c', top: 400, bottom: 300, systemId: 'sys-0' }),
        ];
        // pdfY=500 is in the middle of staff b
        const result = splitSystemAtPosition(staffs, 0, 500, systems);
        // a and upper-b stay in sys-0
        expect(result.staffs.find(s => s.id === 'a')!.systemId).toBe('sys-0');
        expect(result.staffs.find(s => s.id === 'b')!.systemId).toBe('sys-0');
        // lower-b and c move to new system
        const lowerB = result.staffs.find(s => s.id !== 'a' && s.id !== 'b' && s.id !== 'c')!;
        expect(lowerB.systemId).not.toBe('sys-0');
        expect(result.staffs.find(s => s.id === 'c')!.systemId).not.toBe('sys-0');
      });

      it('passes systems through to splitSystemAtGap for gap case', () => {
        const systems: System[] = [
          { id: 'sys-0', pageIndex: 0, top: 750, bottom: 350 },
        ];
        const staffs = [
          makeStaff({ id: 'a', top: 700, bottom: 600, systemId: 'sys-0' }),
          makeStaff({ id: 'b', top: 500, bottom: 400, systemId: 'sys-0' }),
        ];
        const result = splitSystemAtPosition(staffs, 0, 550, systems);

        expect(result.systems).toHaveLength(2);
        expect(result.staffs.find(s => s.id === 'a')!.systemId).toBe('sys-0');
        expect(result.staffs.find(s => s.id === 'b')!.systemId).not.toBe('sys-0');
      });

      it('returns systems unchanged when pdfY is outside all systems', () => {
        const systems: System[] = [
          { id: 'sys-0', pageIndex: 0, top: 750, bottom: 550 },
        ];
        const staffs = [
          makeStaff({ id: 'a', top: 700, bottom: 600, systemId: 'sys-0' }),
        ];
        const result = splitSystemAtPosition(staffs, 0, 100, systems);

        expect(result.systems).toEqual(systems);
        expect(result.staffs).toEqual(staffs);
      });
    });
  });
});
