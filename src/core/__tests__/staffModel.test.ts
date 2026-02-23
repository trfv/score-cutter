import { describe, it, expect } from 'vitest';
import type { Staff } from '../staffModel';
import { derivePartsFromStaffs, applySystemLabelsToAll } from '../staffModel';

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

describe('derivePartsFromStaffs', () => {
  it('groups staffs by label', () => {
    const staffs = [
      makeStaff({ id: 'a', label: 'Violin', pageIndex: 0 }),
      makeStaff({ id: 'b', label: 'Viola', pageIndex: 0 }),
      makeStaff({ id: 'c', label: 'Violin', pageIndex: 1 }),
    ];
    const parts = derivePartsFromStaffs(staffs);
    expect(parts).toHaveLength(2);
    expect(parts.find((p) => p.label === 'Violin')!.staffs).toHaveLength(2);
    expect(parts.find((p) => p.label === 'Viola')!.staffs).toHaveLength(1);
  });

  it('skips staffs with empty labels', () => {
    const staffs = [
      makeStaff({ id: 'a', label: 'Violin' }),
      makeStaff({ id: 'b', label: '' }),
    ];
    const parts = derivePartsFromStaffs(staffs);
    expect(parts).toHaveLength(1);
  });
});

describe('applySystemLabelsToAll', () => {
  it('applies template system labels to all other systems by ordinal position', () => {
    const staffs = [
      // Template: page 0, system 0
      makeStaff({ id: 'a', pageIndex: 0, systemIndex: 0, top: 700, bottom: 650, label: 'Violin' }),
      makeStaff({ id: 'b', pageIndex: 0, systemIndex: 0, top: 600, bottom: 550, label: 'Viola' }),
      // Page 0, system 1
      makeStaff({ id: 'c', pageIndex: 0, systemIndex: 1, top: 400, bottom: 350, label: '' }),
      makeStaff({ id: 'd', pageIndex: 0, systemIndex: 1, top: 300, bottom: 250, label: '' }),
      // Page 1, system 0
      makeStaff({ id: 'e', pageIndex: 1, systemIndex: 0, top: 700, bottom: 650, label: '' }),
      makeStaff({ id: 'f', pageIndex: 1, systemIndex: 0, top: 600, bottom: 550, label: '' }),
    ];

    const result = applySystemLabelsToAll(staffs, 0, 0);

    // Template staffs unchanged
    expect(result.find((s) => s.id === 'a')!.label).toBe('Violin');
    expect(result.find((s) => s.id === 'b')!.label).toBe('Viola');
    // Page 0, system 1 gets labels by ordinal position
    expect(result.find((s) => s.id === 'c')!.label).toBe('Violin');
    expect(result.find((s) => s.id === 'd')!.label).toBe('Viola');
    // Page 1, system 0 gets labels by ordinal position
    expect(result.find((s) => s.id === 'e')!.label).toBe('Violin');
    expect(result.find((s) => s.id === 'f')!.label).toBe('Viola');
  });

  it('does not modify template system staffs', () => {
    const staffs = [
      makeStaff({ id: 'a', pageIndex: 0, systemIndex: 0, top: 700, bottom: 650, label: 'Flute' }),
      makeStaff({ id: 'b', pageIndex: 1, systemIndex: 0, top: 700, bottom: 650, label: 'old' }),
    ];

    const result = applySystemLabelsToAll(staffs, 0, 0);

    expect(result.find((s) => s.id === 'a')!.label).toBe('Flute');
    expect(result.find((s) => s.id === 'b')!.label).toBe('Flute');
  });

  it('applies only up to template length when target has more staffs', () => {
    const staffs = [
      // Template: 2 staffs
      makeStaff({ id: 'a', pageIndex: 0, systemIndex: 0, top: 700, bottom: 650, label: 'Violin' }),
      makeStaff({ id: 'b', pageIndex: 0, systemIndex: 0, top: 600, bottom: 550, label: 'Viola' }),
      // Target: 3 staffs
      makeStaff({ id: 'c', pageIndex: 1, systemIndex: 0, top: 700, bottom: 650, label: '' }),
      makeStaff({ id: 'd', pageIndex: 1, systemIndex: 0, top: 600, bottom: 550, label: '' }),
      makeStaff({ id: 'e', pageIndex: 1, systemIndex: 0, top: 500, bottom: 450, label: 'keep' }),
    ];

    const result = applySystemLabelsToAll(staffs, 0, 0);

    expect(result.find((s) => s.id === 'c')!.label).toBe('Violin');
    expect(result.find((s) => s.id === 'd')!.label).toBe('Viola');
    // Third staff beyond template length keeps its label
    expect(result.find((s) => s.id === 'e')!.label).toBe('keep');
  });

  it('returns staffs unchanged when template system has no staffs', () => {
    const staffs = [
      makeStaff({ id: 'a', pageIndex: 0, systemIndex: 1, top: 700, bottom: 650, label: 'Violin' }),
    ];

    // Template page 0 system 0 has no staffs
    const result = applySystemLabelsToAll(staffs, 0, 0);

    expect(result).toEqual(staffs);
  });

  it('uses a non-zero system as template when specified', () => {
    const staffs = [
      // System 0
      makeStaff({ id: 'a', pageIndex: 0, systemIndex: 0, top: 700, bottom: 650, label: '' }),
      // System 1 (template)
      makeStaff({ id: 'b', pageIndex: 0, systemIndex: 1, top: 400, bottom: 350, label: 'Horn' }),
      // Page 1 system 0
      makeStaff({ id: 'c', pageIndex: 1, systemIndex: 0, top: 700, bottom: 650, label: '' }),
    ];

    const result = applySystemLabelsToAll(staffs, 0, 1);

    // System 0 on page 0 gets template label
    expect(result.find((s) => s.id === 'a')!.label).toBe('Horn');
    // Template unchanged
    expect(result.find((s) => s.id === 'b')!.label).toBe('Horn');
    // Page 1 system 0 gets template label
    expect(result.find((s) => s.id === 'c')!.label).toBe('Horn');
  });
});
