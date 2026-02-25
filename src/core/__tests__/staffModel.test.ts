import { describe, it, expect } from 'vitest';
import type { Staff, System } from '../staffModel';
import {
  derivePartsFromStaffs,
  applySystemLabelsToAll,
  validateStaffCountConsistency,
  validateLabelCompleteness,
  validateDuplicateLabelsInSystems,
  validateLabelConsistency,
  getStaffStepValidations,
  getLabelStepValidations,
  getPageSystems,
  getSystemOrdinal,
  buildSystemOrdinalMap,
  staffsMatchSystems,
} from '../staffModel';

function makeStaff(overrides: Partial<Staff> & { id: string }): Staff {
  return {
    pageIndex: 0,
    top: 100,
    bottom: 50,
    label: '',
    systemId: overrides.systemId ?? `sys-${overrides.pageIndex ?? 0}-0`,
    ...overrides,
  };
}

describe('derivePartsFromStaffs', () => {
  it('groups staffs by label', () => {
    const staffs = [
      makeStaff({ id: 'a', label: 'Violin', pageIndex: 0 }),
      makeStaff({ id: 'b', label: 'Viola', pageIndex: 0 }),
      makeStaff({ id: 'c', label: 'Violin', pageIndex: 1, systemId: 'sys-1-0' }),
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
      makeStaff({ id: 'a', pageIndex: 0, systemId: 'sys-0-0', top: 700, bottom: 650, label: 'Violin' }),
      makeStaff({ id: 'b', pageIndex: 0, systemId: 'sys-0-0', top: 600, bottom: 550, label: 'Viola' }),
      // Page 0, system 1
      makeStaff({ id: 'c', pageIndex: 0, systemId: 'sys-0-1', top: 400, bottom: 350, label: '' }),
      makeStaff({ id: 'd', pageIndex: 0, systemId: 'sys-0-1', top: 300, bottom: 250, label: '' }),
      // Page 1, system 0
      makeStaff({ id: 'e', pageIndex: 1, systemId: 'sys-1-0', top: 700, bottom: 650, label: '' }),
      makeStaff({ id: 'f', pageIndex: 1, systemId: 'sys-1-0', top: 600, bottom: 550, label: '' }),
    ];

    const result = applySystemLabelsToAll(staffs, 'sys-0-0');

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
      makeStaff({ id: 'a', pageIndex: 0, systemId: 'sys-0-0', top: 700, bottom: 650, label: 'Flute' }),
      makeStaff({ id: 'b', pageIndex: 1, systemId: 'sys-1-0', top: 700, bottom: 650, label: 'old' }),
    ];

    const result = applySystemLabelsToAll(staffs, 'sys-0-0');

    expect(result.find((s) => s.id === 'a')!.label).toBe('Flute');
    expect(result.find((s) => s.id === 'b')!.label).toBe('Flute');
  });

  it('applies only up to template length when target has more staffs', () => {
    const staffs = [
      // Template: 2 staffs
      makeStaff({ id: 'a', pageIndex: 0, systemId: 'sys-0-0', top: 700, bottom: 650, label: 'Violin' }),
      makeStaff({ id: 'b', pageIndex: 0, systemId: 'sys-0-0', top: 600, bottom: 550, label: 'Viola' }),
      // Target: 3 staffs
      makeStaff({ id: 'c', pageIndex: 1, systemId: 'sys-1-0', top: 700, bottom: 650, label: '' }),
      makeStaff({ id: 'd', pageIndex: 1, systemId: 'sys-1-0', top: 600, bottom: 550, label: '' }),
      makeStaff({ id: 'e', pageIndex: 1, systemId: 'sys-1-0', top: 500, bottom: 450, label: 'keep' }),
    ];

    const result = applySystemLabelsToAll(staffs, 'sys-0-0');

    expect(result.find((s) => s.id === 'c')!.label).toBe('Violin');
    expect(result.find((s) => s.id === 'd')!.label).toBe('Viola');
    // Third staff beyond template length keeps its label
    expect(result.find((s) => s.id === 'e')!.label).toBe('keep');
  });

  it('returns staffs unchanged when template system has no staffs', () => {
    const staffs = [
      makeStaff({ id: 'a', pageIndex: 0, systemId: 'sys-0-1', top: 700, bottom: 650, label: 'Violin' }),
    ];

    // Template sys-0-0 has no staffs
    const result = applySystemLabelsToAll(staffs, 'sys-0-0');

    expect(result).toEqual(staffs);
  });

  it('returns staffs unchanged when templateSystemId is empty string', () => {
    const staffs = [
      makeStaff({ id: 'a', systemId: 'sys-0', label: 'Violin' }),
    ];
    const result = applySystemLabelsToAll(staffs, '');
    expect(result).toEqual(staffs);
  });

  it('uses a non-zero system as template when specified', () => {
    const staffs = [
      // System 0
      makeStaff({ id: 'a', pageIndex: 0, systemId: 'sys-0-0', top: 700, bottom: 650, label: '' }),
      // System 1 (template)
      makeStaff({ id: 'b', pageIndex: 0, systemId: 'sys-0-1', top: 400, bottom: 350, label: 'Horn' }),
      // Page 1 system 0
      makeStaff({ id: 'c', pageIndex: 1, systemId: 'sys-1-0', top: 700, bottom: 650, label: '' }),
    ];

    const result = applySystemLabelsToAll(staffs, 'sys-0-1');

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
      makeStaff({ id: 'a', pageIndex: 0, systemId: 'sys-0-0', top: 700, bottom: 650 }),
      makeStaff({ id: 'b', pageIndex: 0, systemId: 'sys-0-0', top: 600, bottom: 550 }),
      makeStaff({ id: 'c', pageIndex: 0, systemId: 'sys-0-1', top: 400, bottom: 350 }),
      makeStaff({ id: 'd', pageIndex: 0, systemId: 'sys-0-1', top: 300, bottom: 250 }),
      makeStaff({ id: 'e', pageIndex: 1, systemId: 'sys-1-0', top: 700, bottom: 650 }),
      makeStaff({ id: 'f', pageIndex: 1, systemId: 'sys-1-0', top: 600, bottom: 550 }),
    ];
    const result = validateStaffCountConsistency(staffs);
    expect(result.isConsistent).toBe(true);
    expect(result.expectedCount).toBe(2);
    expect(result.mismatches).toEqual([]);
  });

  it('detects mismatches when one system has a different count', () => {
    const staffs = [
      makeStaff({ id: 'a', pageIndex: 0, systemId: 'sys-0-0', top: 700, bottom: 650 }),
      makeStaff({ id: 'b', pageIndex: 0, systemId: 'sys-0-0', top: 600, bottom: 550 }),
      makeStaff({ id: 'c', pageIndex: 0, systemId: 'sys-0-1', top: 400, bottom: 350 }),
      makeStaff({ id: 'd', pageIndex: 0, systemId: 'sys-0-1', top: 300, bottom: 250 }),
      // Page 1 system 0 has 3 staffs instead of 2
      makeStaff({ id: 'e', pageIndex: 1, systemId: 'sys-1-0', top: 700, bottom: 650 }),
      makeStaff({ id: 'f', pageIndex: 1, systemId: 'sys-1-0', top: 600, bottom: 550 }),
      makeStaff({ id: 'g', pageIndex: 1, systemId: 'sys-1-0', top: 500, bottom: 450 }),
    ];
    const result = validateStaffCountConsistency(staffs);
    expect(result.isConsistent).toBe(false);
    expect(result.expectedCount).toBe(2);
    expect(result.mismatches).toEqual([
      { pageIndex: 1, systemId: 'sys-1-0', count: 3 },
    ]);
  });

  it('uses mode as expected count when multiple different counts exist', () => {
    const staffs = [
      // 3 systems with 2 staffs
      makeStaff({ id: 'a1', pageIndex: 0, systemId: 'sys-0-0' }),
      makeStaff({ id: 'a2', pageIndex: 0, systemId: 'sys-0-0' }),
      makeStaff({ id: 'b1', pageIndex: 0, systemId: 'sys-0-1' }),
      makeStaff({ id: 'b2', pageIndex: 0, systemId: 'sys-0-1' }),
      makeStaff({ id: 'c1', pageIndex: 1, systemId: 'sys-1-0' }),
      makeStaff({ id: 'c2', pageIndex: 1, systemId: 'sys-1-0' }),
      // 1 system with 3 staffs
      makeStaff({ id: 'd1', pageIndex: 1, systemId: 'sys-1-1' }),
      makeStaff({ id: 'd2', pageIndex: 1, systemId: 'sys-1-1' }),
      makeStaff({ id: 'd3', pageIndex: 1, systemId: 'sys-1-1' }),
    ];
    const result = validateStaffCountConsistency(staffs);
    expect(result.isConsistent).toBe(false);
    expect(result.expectedCount).toBe(2);
    expect(result.mismatches).toHaveLength(1);
    expect(result.mismatches[0]).toEqual({ pageIndex: 1, systemId: 'sys-1-1', count: 3 });
  });

  it('returns consistent for a single system', () => {
    const staffs = [
      makeStaff({ id: 'a', pageIndex: 0, systemId: 'sys-0-0' }),
      makeStaff({ id: 'b', pageIndex: 0, systemId: 'sys-0-0' }),
    ];
    const result = validateStaffCountConsistency(staffs);
    expect(result.isConsistent).toBe(true);
    expect(result.expectedCount).toBe(2);
  });

  it('sorts mismatches by pageIndex then systemId', () => {
    const staffs = [
      // Expected: 1 staff per system (mode)
      makeStaff({ id: 'a', pageIndex: 0, systemId: 'sys-0-0' }),
      makeStaff({ id: 'b', pageIndex: 1, systemId: 'sys-1-0' }),
      makeStaff({ id: 'c', pageIndex: 2, systemId: 'sys-2-0' }),
      // Mismatches: 2 staffs
      makeStaff({ id: 'd1', pageIndex: 2, systemId: 'sys-2-1' }),
      makeStaff({ id: 'd2', pageIndex: 2, systemId: 'sys-2-1' }),
      makeStaff({ id: 'e1', pageIndex: 0, systemId: 'sys-0-1' }),
      makeStaff({ id: 'e2', pageIndex: 0, systemId: 'sys-0-1' }),
    ];
    const result = validateStaffCountConsistency(staffs);
    expect(result.mismatches[0].pageIndex).toBe(0);
    expect(result.mismatches[1].pageIndex).toBe(2);
  });

  it('sorts mismatches by systemId when on the same page', () => {
    const staffs = [
      // Expected: 1 staff per system (mode from 3 systems)
      makeStaff({ id: 'a', pageIndex: 0, systemId: 'sys-0' }),
      makeStaff({ id: 'b', pageIndex: 1, systemId: 'sys-1' }),
      makeStaff({ id: 'c', pageIndex: 2, systemId: 'sys-2' }),
      // Two mismatches on the same page with 2 staffs each
      makeStaff({ id: 'd1', pageIndex: 0, systemId: 'sys-0b' }),
      makeStaff({ id: 'd2', pageIndex: 0, systemId: 'sys-0b' }),
      makeStaff({ id: 'e1', pageIndex: 0, systemId: 'sys-0a' }),
      makeStaff({ id: 'e2', pageIndex: 0, systemId: 'sys-0a' }),
    ];
    const result = validateStaffCountConsistency(staffs);
    // Same page → sorted by systemId (localeCompare)
    expect(result.mismatches[0].systemId).toBe('sys-0a');
    expect(result.mismatches[1].systemId).toBe('sys-0b');
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
      makeStaff({ id: 'a', systemId: 'sys-0-0', label: 'Violin' }),
      makeStaff({ id: 'b', systemId: 'sys-0-0', label: 'Viola' }),
    ];
    expect(validateDuplicateLabelsInSystems(staffs)).toEqual([]);
  });

  it('detects duplicate labels within a system', () => {
    const staffs = [
      makeStaff({ id: 'a', systemId: 'sys-0-0', label: 'Violin' }),
      makeStaff({ id: 'b', systemId: 'sys-0-0', label: 'Violin' }),
      makeStaff({ id: 'c', systemId: 'sys-0-0', label: 'Viola' }),
    ];
    const result = validateDuplicateLabelsInSystems(staffs);
    expect(result).toHaveLength(1);
    expect(result[0].duplicateLabels).toEqual(['Violin']);
  });

  it('ignores empty labels when checking for duplicates', () => {
    const staffs = [
      makeStaff({ id: 'a', systemId: 'sys-0-0', label: '' }),
      makeStaff({ id: 'b', systemId: 'sys-0-0', label: '' }),
    ];
    expect(validateDuplicateLabelsInSystems(staffs)).toEqual([]);
  });
});

describe('validateLabelConsistency', () => {
  it('returns consistent when all systems have the same label order', () => {
    const staffs = [
      makeStaff({ id: 'a', pageIndex: 0, systemId: 'sys-0-0', top: 700, bottom: 650, label: 'Violin' }),
      makeStaff({ id: 'b', pageIndex: 0, systemId: 'sys-0-0', top: 600, bottom: 550, label: 'Viola' }),
      makeStaff({ id: 'c', pageIndex: 0, systemId: 'sys-0-1', top: 400, bottom: 350, label: 'Violin' }),
      makeStaff({ id: 'd', pageIndex: 0, systemId: 'sys-0-1', top: 300, bottom: 250, label: 'Viola' }),
    ];
    const result = validateLabelConsistency(staffs);
    expect(result.isConsistent).toBe(true);
  });

  it('detects inconsistent label order', () => {
    const staffs = [
      makeStaff({ id: 'a', pageIndex: 0, systemId: 'sys-0-0', top: 700, bottom: 650, label: 'Violin' }),
      makeStaff({ id: 'b', pageIndex: 0, systemId: 'sys-0-0', top: 600, bottom: 550, label: 'Viola' }),
      // Swapped order in system 1
      makeStaff({ id: 'c', pageIndex: 0, systemId: 'sys-0-1', top: 400, bottom: 350, label: 'Viola' }),
      makeStaff({ id: 'd', pageIndex: 0, systemId: 'sys-0-1', top: 300, bottom: 250, label: 'Violin' }),
    ];
    const result = validateLabelConsistency(staffs);
    expect(result.isConsistent).toBe(false);
    expect(result.mismatches).toHaveLength(1);
    expect(result.mismatches[0].systemId).toBe('sys-0-1');
  });

  it('detects different label count as mismatch', () => {
    const staffs = [
      makeStaff({ id: 'a', pageIndex: 0, systemId: 'sys-0-0', top: 700, bottom: 650, label: 'Violin' }),
      makeStaff({ id: 'b', pageIndex: 0, systemId: 'sys-0-0', top: 600, bottom: 550, label: 'Viola' }),
      // Only one staff in system 1
      makeStaff({ id: 'c', pageIndex: 0, systemId: 'sys-0-1', top: 400, bottom: 350, label: 'Violin' }),
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
      makeStaff({ id: 'a', systemId: 'sys-0-0' }),
      makeStaff({ id: 'b', systemId: 'sys-0-1' }),
    ];
    const messages = getStaffStepValidations(staffs);
    expect(messages).toHaveLength(1);
    expect(messages[0].severity).toBe('success');
    expect(messages[0].messageKey).toBe('validation.staffCountMatch');
  });

  it('returns warning message when inconsistent', () => {
    const staffs = [
      makeStaff({ id: 'a', systemId: 'sys-0-0' }),
      makeStaff({ id: 'b', systemId: 'sys-0-0' }),
      makeStaff({ id: 'c', systemId: 'sys-0-1' }),
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
      makeStaff({ id: 'a', pageIndex: 0, systemId: 'sys-0-0', top: 700, bottom: 650, label: 'Violin' }),
      makeStaff({ id: 'b', pageIndex: 0, systemId: 'sys-0-1', top: 400, bottom: 350, label: 'Violin' }),
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
      makeStaff({ id: 'a', systemId: 'sys-0-0', top: 700, bottom: 650, label: 'Violin' }),
      makeStaff({ id: 'b', systemId: 'sys-0-0', top: 600, bottom: 550, label: 'Violin' }),
    ];
    const messages = getLabelStepValidations(staffs);
    const dupe = messages.find((m) => m.messageKey === 'validation.duplicateLabels');
    expect(dupe).toBeDefined();
    expect(dupe!.severity).toBe('warning');
  });

  it('warns about label order mismatch across systems', () => {
    const staffs = [
      makeStaff({ id: 'a', pageIndex: 0, systemId: 'sys-0', top: 700, bottom: 650, label: 'Violin' }),
      makeStaff({ id: 'b', pageIndex: 0, systemId: 'sys-0', top: 600, bottom: 550, label: 'Viola' }),
      // Swapped order in second system
      makeStaff({ id: 'c', pageIndex: 0, systemId: 'sys-1', top: 400, bottom: 350, label: 'Viola' }),
      makeStaff({ id: 'd', pageIndex: 0, systemId: 'sys-1', top: 300, bottom: 250, label: 'Violin' }),
    ];
    const messages = getLabelStepValidations(staffs);
    const mismatch = messages.find((m) => m.messageKey === 'validation.labelOrderMismatch');
    expect(mismatch).toBeDefined();
    expect(mismatch!.severity).toBe('warning');
  });
});

// --- System utility functions ---

function makeSystem(overrides: Partial<System> & { id: string }): System {
  return {
    pageIndex: 0,
    top: 800,
    bottom: 600,
    ...overrides,
  };
}

describe('getPageSystems', () => {
  it('returns systems for the specified page sorted by top descending (visual top-to-bottom)', () => {
    const systems: System[] = [
      makeSystem({ id: 's1', pageIndex: 0, top: 700, bottom: 400 }),
      makeSystem({ id: 's2', pageIndex: 0, top: 800, bottom: 710 }),
      makeSystem({ id: 's3', pageIndex: 1, top: 800, bottom: 600 }),
    ];
    const result = getPageSystems(systems, 0);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('s2'); // top=800 first (highest in PDF coords)
    expect(result[1].id).toBe('s1'); // top=700 second
  });

  it('returns empty array when no systems on the page', () => {
    const systems: System[] = [
      makeSystem({ id: 's1', pageIndex: 1 }),
    ];
    expect(getPageSystems(systems, 0)).toEqual([]);
  });

  it('returns empty array for empty systems', () => {
    expect(getPageSystems([], 0)).toEqual([]);
  });
});

describe('getSystemOrdinal', () => {
  it('returns 0-based ordinal for a system on its page', () => {
    const systems: System[] = [
      makeSystem({ id: 's1', pageIndex: 0, top: 800, bottom: 600 }),
      makeSystem({ id: 's2', pageIndex: 0, top: 500, bottom: 300 }),
    ];
    expect(getSystemOrdinal(systems, 0, 's1')).toBe(0);
    expect(getSystemOrdinal(systems, 0, 's2')).toBe(1);
  });

  it('returns -1 for unknown systemId', () => {
    const systems: System[] = [
      makeSystem({ id: 's1', pageIndex: 0, top: 800, bottom: 600 }),
    ];
    expect(getSystemOrdinal(systems, 0, 'unknown')).toBe(-1);
  });

  it('computes ordinal independently per page', () => {
    const systems: System[] = [
      makeSystem({ id: 's1', pageIndex: 0, top: 800, bottom: 600 }),
      makeSystem({ id: 's2', pageIndex: 0, top: 500, bottom: 300 }),
      makeSystem({ id: 's3', pageIndex: 1, top: 800, bottom: 600 }),
    ];
    expect(getSystemOrdinal(systems, 0, 's1')).toBe(0);
    expect(getSystemOrdinal(systems, 0, 's2')).toBe(1);
    expect(getSystemOrdinal(systems, 1, 's3')).toBe(0);
  });
});

describe('staffsMatchSystems', () => {
  it('returns false for empty staffs', () => {
    const systems: System[] = [makeSystem({ id: 's1' })];
    expect(staffsMatchSystems([], systems)).toBe(false);
  });

  it('returns true when all staff systemIds match existing systems', () => {
    const systems: System[] = [
      makeSystem({ id: 'sys-A' }),
      makeSystem({ id: 'sys-B' }),
    ];
    const staffs = [
      makeStaff({ id: 'a', systemId: 'sys-A' }),
      makeStaff({ id: 'b', systemId: 'sys-B' }),
    ];
    expect(staffsMatchSystems(staffs, systems)).toBe(true);
  });

  it('returns false when a staff systemId does not exist in systems', () => {
    const systems: System[] = [makeSystem({ id: 'sys-A' })];
    const staffs = [
      makeStaff({ id: 'a', systemId: 'sys-A' }),
      makeStaff({ id: 'b', systemId: 'sys-DELETED' }),
    ];
    expect(staffsMatchSystems(staffs, systems)).toBe(false);
  });

  it('returns false when systems is empty but staffs exist', () => {
    const staffs = [makeStaff({ id: 'a', systemId: 'sys-A' })];
    expect(staffsMatchSystems(staffs, [])).toBe(false);
  });

  it('returns true for single staff matching single system', () => {
    const systems: System[] = [makeSystem({ id: 'sys-X' })];
    const staffs = [makeStaff({ id: 'a', systemId: 'sys-X' })];
    expect(staffsMatchSystems(staffs, systems)).toBe(true);
  });
});

describe('buildSystemOrdinalMap', () => {
  it('builds a map from systemId to ordinal for a page', () => {
    const systems: System[] = [
      makeSystem({ id: 's1', pageIndex: 0, top: 800, bottom: 600 }),
      makeSystem({ id: 's2', pageIndex: 0, top: 500, bottom: 300 }),
      makeSystem({ id: 's3', pageIndex: 1, top: 800, bottom: 600 }),
    ];
    const map = buildSystemOrdinalMap(systems, 0);
    expect(map.size).toBe(2);
    expect(map.get('s1')).toBe(0);
    expect(map.get('s2')).toBe(1);
  });

  it('returns empty map for page with no systems', () => {
    const systems: System[] = [
      makeSystem({ id: 's1', pageIndex: 1 }),
    ];
    expect(buildSystemOrdinalMap(systems, 0).size).toBe(0);
  });
});

// --- systemId-based grouping tests ---

describe('applySystemLabelsToAll with templateSystemId', () => {
  it('uses templateSystemId directly', () => {
    const staffs = [
      // Template system (custom systemId)
      makeStaff({ id: 'a', pageIndex: 0, top: 700, bottom: 650, label: 'Flute', systemId: 'sys-template' }),
      makeStaff({ id: 'b', pageIndex: 0, top: 600, bottom: 550, label: 'Oboe', systemId: 'sys-template' }),
      // Target system (different systemId)
      makeStaff({ id: 'c', pageIndex: 1, top: 700, bottom: 650, label: '', systemId: 'sys-other' }),
      makeStaff({ id: 'd', pageIndex: 1, top: 600, bottom: 550, label: '', systemId: 'sys-other' }),
    ];

    const result = applySystemLabelsToAll(staffs, 'sys-template');

    expect(result.find(s => s.id === 'a')!.label).toBe('Flute');
    expect(result.find(s => s.id === 'b')!.label).toBe('Oboe');
    expect(result.find(s => s.id === 'c')!.label).toBe('Flute');
    expect(result.find(s => s.id === 'd')!.label).toBe('Oboe');
  });

  it('applies labels from specified templateSystemId', () => {
    const staffs = [
      makeStaff({ id: 'a', pageIndex: 0, top: 700, bottom: 650, label: 'Violin', systemId: 'sys-A' }),
      makeStaff({ id: 'b', pageIndex: 0, top: 400, bottom: 350, label: '', systemId: 'sys-B' }),
    ];

    const result = applySystemLabelsToAll(staffs, 'sys-A');

    expect(result.find(s => s.id === 'a')!.label).toBe('Violin');
    expect(result.find(s => s.id === 'b')!.label).toBe('Violin');
  });
});

describe('validateStaffCountConsistency with systemId grouping', () => {
  it('groups by systemId, not pageIndex-ordinal', () => {
    // Two staffs with same systemId → same group
    const staffs = [
      makeStaff({ id: 'a', pageIndex: 0, systemId: 'shared-sys' }),
      makeStaff({ id: 'b', pageIndex: 0, systemId: 'shared-sys' }),
      // One staff in a different system
      makeStaff({ id: 'c', pageIndex: 0, systemId: 'other-sys' }),
    ];
    const result = validateStaffCountConsistency(staffs);
    // shared-sys has 2 staffs, other-sys has 1 → mismatch
    expect(result.isConsistent).toBe(false);
    expect(result.expectedCount).toBe(2);
    expect(result.mismatches).toHaveLength(1);
  });
});

describe('validateDuplicateLabelsInSystems with systemId grouping', () => {
  it('groups by systemId when detecting duplicates', () => {
    // Same label in same systemId → duplicate
    const staffs = [
      makeStaff({ id: 'a', label: 'Violin', systemId: 'sys-X' }),
      makeStaff({ id: 'b', label: 'Violin', systemId: 'sys-X' }),
    ];
    const result = validateDuplicateLabelsInSystems(staffs);
    expect(result).toHaveLength(1);
    expect(result[0].duplicateLabels).toEqual(['Violin']);
  });

  it('does not flag as duplicate when same label is in different systemIds', () => {
    const staffs = [
      makeStaff({ id: 'a', label: 'Violin', systemId: 'sys-A' }),
      makeStaff({ id: 'b', label: 'Violin', systemId: 'sys-B' }),
    ];
    const result = validateDuplicateLabelsInSystems(staffs);
    expect(result).toEqual([]);
  });
});

describe('validateLabelConsistency with systemId grouping', () => {
  it('groups by systemId when checking label order', () => {
    // Two systems identified by systemId
    const staffs = [
      makeStaff({ id: 'a', pageIndex: 0, top: 700, bottom: 650, label: 'Violin', systemId: 'sys-P' }),
      makeStaff({ id: 'b', pageIndex: 0, top: 600, bottom: 550, label: 'Viola', systemId: 'sys-P' }),
      makeStaff({ id: 'c', pageIndex: 0, top: 400, bottom: 350, label: 'Violin', systemId: 'sys-Q' }),
      makeStaff({ id: 'd', pageIndex: 0, top: 300, bottom: 250, label: 'Viola', systemId: 'sys-Q' }),
    ];
    const result = validateLabelConsistency(staffs);
    expect(result.isConsistent).toBe(true);
  });

  it('detects inconsistency across systems identified by systemId', () => {
    const staffs = [
      makeStaff({ id: 'a', pageIndex: 0, top: 700, bottom: 650, label: 'Violin', systemId: 'sys-P' }),
      makeStaff({ id: 'b', pageIndex: 0, top: 600, bottom: 550, label: 'Viola', systemId: 'sys-P' }),
      // Swapped order in sys-Q
      makeStaff({ id: 'c', pageIndex: 0, top: 400, bottom: 350, label: 'Viola', systemId: 'sys-Q' }),
      makeStaff({ id: 'd', pageIndex: 0, top: 300, bottom: 250, label: 'Violin', systemId: 'sys-Q' }),
    ];
    const result = validateLabelConsistency(staffs);
    expect(result.isConsistent).toBe(false);
    expect(result.mismatches).toHaveLength(1);
  });
});

describe('derivePartsFromStaffs with systems', () => {
  it('sorts by system ordinal from System entities when provided', () => {
    const systems: System[] = [
      makeSystem({ id: 'sys-upper', pageIndex: 0, top: 800, bottom: 500 }),
      makeSystem({ id: 'sys-lower', pageIndex: 0, top: 400, bottom: 100 }),
    ];
    const staffs = [
      // sys-lower (ordinal 1) added first in array
      makeStaff({ id: 'a', pageIndex: 0, top: 400, bottom: 350, label: 'Violin', systemId: 'sys-lower' }),
      // sys-upper (ordinal 0) added second
      makeStaff({ id: 'b', pageIndex: 0, top: 800, bottom: 750, label: 'Violin', systemId: 'sys-upper' }),
    ];

    const parts = derivePartsFromStaffs(staffs, systems);
    expect(parts).toHaveLength(1);
    // Should sort by system ordinal: sys-upper (ordinal 0) first
    expect(parts[0].staffs[0].id).toBe('b');
    expect(parts[0].staffs[1].id).toBe('a');
  });

  it('falls back to systemId comparison when no systems provided', () => {
    const staffs = [
      makeStaff({ id: 'a', pageIndex: 0, systemId: 'sys-0-1', top: 400, bottom: 350, label: 'Violin' }),
      makeStaff({ id: 'b', pageIndex: 0, systemId: 'sys-0-0', top: 800, bottom: 750, label: 'Violin' }),
    ];

    const parts = derivePartsFromStaffs(staffs);
    expect(parts[0].staffs[0].id).toBe('b'); // sys-0-0 first (alphabetical)
    expect(parts[0].staffs[1].id).toBe('a'); // sys-0-1 second
  });

  it('falls back to top descending within same systemId when no systems provided', () => {
    const staffs = [
      makeStaff({ id: 'a', pageIndex: 0, systemId: 'sys-0', top: 500, bottom: 400, label: 'Violin' }),
      makeStaff({ id: 'b', pageIndex: 0, systemId: 'sys-0', top: 700, bottom: 600, label: 'Violin' }),
    ];

    const parts = derivePartsFromStaffs(staffs);
    expect(parts[0].staffs[0].id).toBe('b'); // top 700 first
    expect(parts[0].staffs[1].id).toBe('a'); // top 500 second
  });

  it('sorts by top descending within the same system ordinal', () => {
    const systems: System[] = [
      makeSystem({ id: 'sys-0', pageIndex: 0, top: 800, bottom: 300 }),
    ];
    const staffs = [
      makeStaff({ id: 'a', pageIndex: 0, top: 500, bottom: 400, label: 'Violin', systemId: 'sys-0' }),
      makeStaff({ id: 'b', pageIndex: 0, top: 700, bottom: 600, label: 'Violin', systemId: 'sys-0' }),
    ];

    const parts = derivePartsFromStaffs(staffs, systems);
    expect(parts[0].staffs[0].id).toBe('b'); // top 700 first
    expect(parts[0].staffs[1].id).toBe('a'); // top 500 second
  });

  it('sorts by system ordinal even when alphabetical systemId order differs from positional order', () => {
    const systems: System[] = [
      makeSystem({ id: 'zz-uuid-upper', pageIndex: 0, top: 800, bottom: 500 }),
      makeSystem({ id: 'aa-uuid-lower', pageIndex: 0, top: 400, bottom: 100 }),
    ];
    const staffs = [
      makeStaff({ id: 'a', pageIndex: 0, top: 350, bottom: 300, label: 'Violin', systemId: 'aa-uuid-lower' }),
      makeStaff({ id: 'b', pageIndex: 0, top: 750, bottom: 700, label: 'Violin', systemId: 'zz-uuid-upper' }),
    ];

    // Without systems: alphabetical order → aa-uuid-lower first (incorrect for page layout)
    const partsWithout = derivePartsFromStaffs(staffs);
    expect(partsWithout[0].staffs[0].id).toBe('a');
    expect(partsWithout[0].staffs[1].id).toBe('b');

    // With systems: ordinal order → zz-uuid-upper (top=800, ordinal 0) first (correct)
    const partsWith = derivePartsFromStaffs(staffs, systems);
    expect(partsWith[0].staffs[0].id).toBe('b');
    expect(partsWith[0].staffs[1].id).toBe('a');
  });
});
