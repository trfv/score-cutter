import { describe, it, expect } from 'vitest';
import { derivePartsFromStaffs } from '../staffModel';
import type { Staff } from '../staffModel';

describe('derivePartsFromStaffs', () => {
  it('should return empty array for empty staffs', () => {
    expect(derivePartsFromStaffs([])).toEqual([]);
  });

  it('should skip staffs without labels', () => {
    const staffs: Staff[] = [
      { id: '1', pageIndex: 0, top: 700, bottom: 600, label: '', systemIndex: 0 },
    ];
    expect(derivePartsFromStaffs(staffs)).toEqual([]);
  });

  it('should group staffs by label', () => {
    const staffs: Staff[] = [
      { id: '1', pageIndex: 0, top: 700, bottom: 600, label: 'Violin I', systemIndex: 0 },
      { id: '2', pageIndex: 0, top: 500, bottom: 400, label: 'Cello', systemIndex: 0 },
      { id: '3', pageIndex: 1, top: 700, bottom: 600, label: 'Violin I', systemIndex: 0 },
    ];
    const parts = derivePartsFromStaffs(staffs);
    expect(parts).toHaveLength(2);

    const violinPart = parts.find((p) => p.label === 'Violin I');
    expect(violinPart).toBeDefined();
    expect(violinPart!.staffs).toHaveLength(2);

    const celloPart = parts.find((p) => p.label === 'Cello');
    expect(celloPart).toBeDefined();
    expect(celloPart!.staffs).toHaveLength(1);
  });

  it('should sort staffs by page then by top (descending, i.e. top of page first)', () => {
    const staffs: Staff[] = [
      { id: '1', pageIndex: 1, top: 700, bottom: 600, label: 'Violin I', systemIndex: 0 },
      { id: '2', pageIndex: 0, top: 500, bottom: 400, label: 'Violin I', systemIndex: 0 },
      { id: '3', pageIndex: 0, top: 700, bottom: 600, label: 'Violin I', systemIndex: 0 },
    ];
    const parts = derivePartsFromStaffs(staffs);
    const violinPart = parts[0];
    expect(violinPart.staffs[0].id).toBe('3'); // page 0, top 700
    expect(violinPart.staffs[1].id).toBe('2'); // page 0, top 500
    expect(violinPart.staffs[2].id).toBe('1'); // page 1, top 700
  });

  it('should sort staffs by page, then systemIndex, then top descending', () => {
    const staffs: Staff[] = [
      { id: '1', pageIndex: 0, top: 700, bottom: 600, label: 'Violin I', systemIndex: 1 },
      { id: '2', pageIndex: 0, top: 700, bottom: 600, label: 'Violin I', systemIndex: 0 },
      { id: '3', pageIndex: 0, top: 300, bottom: 200, label: 'Violin I', systemIndex: 0 },
    ];
    const parts = derivePartsFromStaffs(staffs);
    const violinPart = parts[0];
    expect(violinPart.staffs[0].id).toBe('2'); // page 0, system 0, top 700
    expect(violinPart.staffs[1].id).toBe('3'); // page 0, system 0, top 300
    expect(violinPart.staffs[2].id).toBe('1'); // page 0, system 1, top 700
  });
});
