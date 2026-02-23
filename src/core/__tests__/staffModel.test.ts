import { describe, it, expect } from 'vitest';
import type { Staff } from '../staffModel';
import {
  derivePartsFromStaffs,
  applySystemLabelsToAll,
  validateStaffCountConsistency,
  validateLabelCompleteness,
  validateDuplicateLabelsInSystems,
  validateLabelConsistency,
  getStaffStepValidations,
  getLabelStepValidations,
} from '../staffModel';

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

describe('validateStaffCountConsistency', () => {
  it('returns consistent for empty staffs', () => {
    const result = validateStaffCountConsistency([]);
    expect(result.isConsistent).toBe(true);
    expect(result.expectedCount).toBeUndefined();
    expect(result.mismatches).toEqual([]);
  });

  it('returns consistent when all systems have the same staff count', () => {
    const staffs = [
      makeStaff({ id: 'a', pageIndex: 0, systemIndex: 0, top: 700, bottom: 650 }),
      makeStaff({ id: 'b', pageIndex: 0, systemIndex: 0, top: 600, bottom: 550 }),
      makeStaff({ id: 'c', pageIndex: 0, systemIndex: 1, top: 400, bottom: 350 }),
      makeStaff({ id: 'd', pageIndex: 0, systemIndex: 1, top: 300, bottom: 250 }),
      makeStaff({ id: 'e', pageIndex: 1, systemIndex: 0, top: 700, bottom: 650 }),
      makeStaff({ id: 'f', pageIndex: 1, systemIndex: 0, top: 600, bottom: 550 }),
    ];
    const result = validateStaffCountConsistency(staffs);
    expect(result.isConsistent).toBe(true);
    expect(result.expectedCount).toBe(2);
    expect(result.mismatches).toEqual([]);
  });

  it('detects mismatches when one system has a different count', () => {
    const staffs = [
      makeStaff({ id: 'a', pageIndex: 0, systemIndex: 0, top: 700, bottom: 650 }),
      makeStaff({ id: 'b', pageIndex: 0, systemIndex: 0, top: 600, bottom: 550 }),
      makeStaff({ id: 'c', pageIndex: 0, systemIndex: 1, top: 400, bottom: 350 }),
      makeStaff({ id: 'd', pageIndex: 0, systemIndex: 1, top: 300, bottom: 250 }),
      // Page 1 system 0 has 3 staffs instead of 2
      makeStaff({ id: 'e', pageIndex: 1, systemIndex: 0, top: 700, bottom: 650 }),
      makeStaff({ id: 'f', pageIndex: 1, systemIndex: 0, top: 600, bottom: 550 }),
      makeStaff({ id: 'g', pageIndex: 1, systemIndex: 0, top: 500, bottom: 450 }),
    ];
    const result = validateStaffCountConsistency(staffs);
    expect(result.isConsistent).toBe(false);
    expect(result.expectedCount).toBe(2);
    expect(result.mismatches).toEqual([
      { pageIndex: 1, systemIndex: 0, count: 3 },
    ]);
  });

  it('uses mode as expected count when multiple different counts exist', () => {
    const staffs = [
      // 3 systems with 2 staffs
      makeStaff({ id: 'a1', pageIndex: 0, systemIndex: 0 }),
      makeStaff({ id: 'a2', pageIndex: 0, systemIndex: 0 }),
      makeStaff({ id: 'b1', pageIndex: 0, systemIndex: 1 }),
      makeStaff({ id: 'b2', pageIndex: 0, systemIndex: 1 }),
      makeStaff({ id: 'c1', pageIndex: 1, systemIndex: 0 }),
      makeStaff({ id: 'c2', pageIndex: 1, systemIndex: 0 }),
      // 1 system with 3 staffs
      makeStaff({ id: 'd1', pageIndex: 1, systemIndex: 1 }),
      makeStaff({ id: 'd2', pageIndex: 1, systemIndex: 1 }),
      makeStaff({ id: 'd3', pageIndex: 1, systemIndex: 1 }),
    ];
    const result = validateStaffCountConsistency(staffs);
    expect(result.isConsistent).toBe(false);
    expect(result.expectedCount).toBe(2);
    expect(result.mismatches).toHaveLength(1);
    expect(result.mismatches[0]).toEqual({ pageIndex: 1, systemIndex: 1, count: 3 });
  });

  it('returns consistent for a single system', () => {
    const staffs = [
      makeStaff({ id: 'a', pageIndex: 0, systemIndex: 0 }),
      makeStaff({ id: 'b', pageIndex: 0, systemIndex: 0 }),
    ];
    const result = validateStaffCountConsistency(staffs);
    expect(result.isConsistent).toBe(true);
    expect(result.expectedCount).toBe(2);
  });

  it('sorts mismatches by pageIndex then systemIndex', () => {
    const staffs = [
      // Expected: 1 staff per system (mode)
      makeStaff({ id: 'a', pageIndex: 0, systemIndex: 0 }),
      makeStaff({ id: 'b', pageIndex: 1, systemIndex: 0 }),
      makeStaff({ id: 'c', pageIndex: 2, systemIndex: 0 }),
      // Mismatches: 2 staffs
      makeStaff({ id: 'd1', pageIndex: 2, systemIndex: 1 }),
      makeStaff({ id: 'd2', pageIndex: 2, systemIndex: 1 }),
      makeStaff({ id: 'e1', pageIndex: 0, systemIndex: 1 }),
      makeStaff({ id: 'e2', pageIndex: 0, systemIndex: 1 }),
    ];
    const result = validateStaffCountConsistency(staffs);
    expect(result.mismatches[0].pageIndex).toBe(0);
    expect(result.mismatches[1].pageIndex).toBe(2);
  });
});

describe('validateLabelCompleteness', () => {
  it('returns zero unlabeled for all-labeled staffs', () => {
    const staffs = [
      makeStaff({ id: 'a', label: 'Violin' }),
      makeStaff({ id: 'b', label: 'Viola' }),
    ];
    const result = validateLabelCompleteness(staffs);
    expect(result.unlabeledCount).toBe(0);
    expect(result.totalCount).toBe(2);
  });

  it('counts unlabeled staffs correctly', () => {
    const staffs = [
      makeStaff({ id: 'a', label: 'Violin' }),
      makeStaff({ id: 'b', label: '' }),
      makeStaff({ id: 'c', label: '' }),
    ];
    const result = validateLabelCompleteness(staffs);
    expect(result.unlabeledCount).toBe(2);
    expect(result.totalCount).toBe(3);
  });
});

describe('validateDuplicateLabelsInSystems', () => {
  it('returns empty array when no duplicates', () => {
    const staffs = [
      makeStaff({ id: 'a', systemIndex: 0, label: 'Violin' }),
      makeStaff({ id: 'b', systemIndex: 0, label: 'Viola' }),
    ];
    expect(validateDuplicateLabelsInSystems(staffs)).toEqual([]);
  });

  it('detects duplicate labels within a system', () => {
    const staffs = [
      makeStaff({ id: 'a', systemIndex: 0, label: 'Violin' }),
      makeStaff({ id: 'b', systemIndex: 0, label: 'Violin' }),
      makeStaff({ id: 'c', systemIndex: 0, label: 'Viola' }),
    ];
    const result = validateDuplicateLabelsInSystems(staffs);
    expect(result).toHaveLength(1);
    expect(result[0].duplicateLabels).toEqual(['Violin']);
  });

  it('ignores empty labels when checking for duplicates', () => {
    const staffs = [
      makeStaff({ id: 'a', systemIndex: 0, label: '' }),
      makeStaff({ id: 'b', systemIndex: 0, label: '' }),
    ];
    expect(validateDuplicateLabelsInSystems(staffs)).toEqual([]);
  });
});

describe('validateLabelConsistency', () => {
  it('returns consistent when all systems have the same label order', () => {
    const staffs = [
      makeStaff({ id: 'a', pageIndex: 0, systemIndex: 0, top: 700, bottom: 650, label: 'Violin' }),
      makeStaff({ id: 'b', pageIndex: 0, systemIndex: 0, top: 600, bottom: 550, label: 'Viola' }),
      makeStaff({ id: 'c', pageIndex: 0, systemIndex: 1, top: 400, bottom: 350, label: 'Violin' }),
      makeStaff({ id: 'd', pageIndex: 0, systemIndex: 1, top: 300, bottom: 250, label: 'Viola' }),
    ];
    const result = validateLabelConsistency(staffs);
    expect(result.isConsistent).toBe(true);
  });

  it('detects inconsistent label order', () => {
    const staffs = [
      makeStaff({ id: 'a', pageIndex: 0, systemIndex: 0, top: 700, bottom: 650, label: 'Violin' }),
      makeStaff({ id: 'b', pageIndex: 0, systemIndex: 0, top: 600, bottom: 550, label: 'Viola' }),
      // Swapped order in system 1
      makeStaff({ id: 'c', pageIndex: 0, systemIndex: 1, top: 400, bottom: 350, label: 'Viola' }),
      makeStaff({ id: 'd', pageIndex: 0, systemIndex: 1, top: 300, bottom: 250, label: 'Violin' }),
    ];
    const result = validateLabelConsistency(staffs);
    expect(result.isConsistent).toBe(false);
    expect(result.mismatches).toHaveLength(1);
    expect(result.mismatches[0].systemIndex).toBe(1);
  });

  it('detects different label count as mismatch', () => {
    const staffs = [
      makeStaff({ id: 'a', pageIndex: 0, systemIndex: 0, top: 700, bottom: 650, label: 'Violin' }),
      makeStaff({ id: 'b', pageIndex: 0, systemIndex: 0, top: 600, bottom: 550, label: 'Viola' }),
      // Only one staff in system 1
      makeStaff({ id: 'c', pageIndex: 0, systemIndex: 1, top: 400, bottom: 350, label: 'Violin' }),
    ];
    const result = validateLabelConsistency(staffs);
    expect(result.isConsistent).toBe(false);
  });

  it('returns consistent for empty staffs', () => {
    const result = validateLabelConsistency([]);
    expect(result.isConsistent).toBe(true);
    expect(result.expectedLabels).toEqual([]);
  });
});

describe('getStaffStepValidations', () => {
  it('returns success message when consistent', () => {
    const staffs = [
      makeStaff({ id: 'a', systemIndex: 0 }),
      makeStaff({ id: 'b', systemIndex: 1 }),
    ];
    const messages = getStaffStepValidations(staffs);
    expect(messages).toHaveLength(1);
    expect(messages[0].severity).toBe('success');
    expect(messages[0].messageKey).toBe('validation.staffCountMatch');
  });

  it('returns warning message when inconsistent', () => {
    const staffs = [
      makeStaff({ id: 'a', systemIndex: 0 }),
      makeStaff({ id: 'b', systemIndex: 0 }),
      makeStaff({ id: 'c', systemIndex: 1 }),
    ];
    const messages = getStaffStepValidations(staffs);
    expect(messages).toHaveLength(1);
    expect(messages[0].severity).toBe('warning');
    expect(messages[0].messageKey).toBe('validation.staffCountMismatch');
  });
});

describe('getLabelStepValidations', () => {
  it('returns success when all staffs are labeled consistently', () => {
    const staffs = [
      makeStaff({ id: 'a', pageIndex: 0, systemIndex: 0, top: 700, bottom: 650, label: 'Violin' }),
      makeStaff({ id: 'b', pageIndex: 0, systemIndex: 1, top: 400, bottom: 350, label: 'Violin' }),
    ];
    const messages = getLabelStepValidations(staffs);
    expect(messages).toHaveLength(1);
    expect(messages[0].severity).toBe('success');
    expect(messages[0].messageKey).toBe('validation.labelsComplete');
  });

  it('warns about unlabeled staffs', () => {
    const staffs = [
      makeStaff({ id: 'a', label: 'Violin' }),
      makeStaff({ id: 'b', label: '' }),
    ];
    const messages = getLabelStepValidations(staffs);
    const unlabeled = messages.find((m) => m.messageKey === 'validation.unlabeledStaffs');
    expect(unlabeled).toBeDefined();
    expect(unlabeled!.severity).toBe('warning');
  });

  it('warns about duplicate labels in a system', () => {
    const staffs = [
      makeStaff({ id: 'a', systemIndex: 0, top: 700, bottom: 650, label: 'Violin' }),
      makeStaff({ id: 'b', systemIndex: 0, top: 600, bottom: 550, label: 'Violin' }),
    ];
    const messages = getLabelStepValidations(staffs);
    const dupe = messages.find((m) => m.messageKey === 'validation.duplicateLabels');
    expect(dupe).toBeDefined();
    expect(dupe!.severity).toBe('warning');
  });
});
