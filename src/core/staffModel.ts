export interface Staff {
  id: string;
  pageIndex: number;
  top: number;
  bottom: number;
  label: string;
  systemIndex: number;
}

export interface Part {
  label: string;
  staffs: Staff[];
}

export interface PageDimension {
  width: number;
  height: number;
}

export function applySystemLabelsToAll(
  staffs: Staff[],
  templatePageIndex: number,
  templateSystemIndex: number,
): Staff[] {
  const templateStaffs = staffs
    .filter((s) => s.pageIndex === templatePageIndex && s.systemIndex === templateSystemIndex)
    .sort((a, b) => b.top - a.top);

  if (templateStaffs.length === 0) return staffs;

  const systemKey = (s: Staff) => `${s.pageIndex}-${s.systemIndex}`;
  const templateKey = `${templatePageIndex}-${templateSystemIndex}`;

  // Pre-group and sort each system for O(1) lookup
  const grouped = new Map<string, Staff[]>();
  for (const s of staffs) {
    const key = systemKey(s);
    const group = grouped.get(key) ?? [];
    group.push(s);
    grouped.set(key, group);
  }
  for (const group of grouped.values()) {
    group.sort((a, b) => b.top - a.top);
  }

  return staffs.map((staff) => {
    const key = systemKey(staff);
    if (key === templateKey) return staff;

    const group = grouped.get(key)!;
    const idx = group.indexOf(staff);
    if (idx >= 0 && idx < templateStaffs.length) {
      return { ...staff, label: templateStaffs[idx].label };
    }
    return staff;
  });
}

// --- Validation ---

export type ValidationSeverity = 'success' | 'warning';

export interface ValidationMessage {
  severity: ValidationSeverity;
  messageKey: string;
  messageParams?: Record<string, string | number>;
}

interface StaffCountConsistencyResult {
  isConsistent: boolean;
  expectedCount: number | undefined;
  mismatches: Array<{ pageIndex: number; systemIndex: number; count: number }>;
}

interface LabelConsistencyResult {
  isConsistent: boolean;
  expectedLabels: string[];
  mismatches: Array<{ pageIndex: number; systemIndex: number; labels: string[] }>;
}

export function validateStaffCountConsistency(staffs: Staff[]): StaffCountConsistencyResult {
  if (staffs.length === 0) {
    return { isConsistent: true, expectedCount: undefined, mismatches: [] };
  }

  const systemCounts = new Map<string, { pageIndex: number; systemIndex: number; count: number }>();
  for (const s of staffs) {
    const key = `${s.pageIndex}-${s.systemIndex}`;
    const entry = systemCounts.get(key);
    if (entry) {
      entry.count++;
    } else {
      systemCounts.set(key, { pageIndex: s.pageIndex, systemIndex: s.systemIndex, count: 1 });
    }
  }

  const countFreq = new Map<number, number>();
  for (const { count } of systemCounts.values()) {
    countFreq.set(count, (countFreq.get(count) ?? 0) + 1);
  }
  let expectedCount = 0;
  let maxFreq = 0;
  for (const [count, freq] of countFreq) {
    if (freq > maxFreq || (freq === maxFreq && count > expectedCount)) {
      expectedCount = count;
      maxFreq = freq;
    }
  }

  const mismatches = [...systemCounts.values()]
    .filter((e) => e.count !== expectedCount)
    .sort((a, b) => a.pageIndex - b.pageIndex || a.systemIndex - b.systemIndex);

  return { isConsistent: mismatches.length === 0, expectedCount, mismatches };
}

export function validateLabelCompleteness(staffs: Staff[]): { unlabeledCount: number; totalCount: number } {
  return {
    unlabeledCount: staffs.filter((s) => !s.label).length,
    totalCount: staffs.length,
  };
}

export function validateDuplicateLabelsInSystems(
  staffs: Staff[],
): Array<{ pageIndex: number; systemIndex: number; duplicateLabels: string[] }> {
  const grouped = new Map<string, Staff[]>();
  for (const s of staffs) {
    const key = `${s.pageIndex}-${s.systemIndex}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(s);
  }

  const results: Array<{ pageIndex: number; systemIndex: number; duplicateLabels: string[] }> = [];
  for (const group of grouped.values()) {
    const labelCounts = new Map<string, number>();
    for (const s of group) {
      if (!s.label) continue;
      labelCounts.set(s.label, (labelCounts.get(s.label) ?? 0) + 1);
    }
    const dupes = [...labelCounts.entries()].filter(([, c]) => c > 1).map(([l]) => l);
    if (dupes.length > 0) {
      results.push({
        pageIndex: group[0].pageIndex,
        systemIndex: group[0].systemIndex,
        duplicateLabels: dupes,
      });
    }
  }
  return results;
}

export function validateLabelConsistency(staffs: Staff[]): LabelConsistencyResult {
  const grouped = new Map<string, Staff[]>();
  for (const s of staffs) {
    const key = `${s.pageIndex}-${s.systemIndex}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(s);
  }
  for (const group of grouped.values()) {
    group.sort((a, b) => b.top - a.top);
  }

  if (grouped.size === 0) {
    return { isConsistent: true, expectedLabels: [], mismatches: [] };
  }

  const systems = [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b));
  let expectedLabels: string[] = systems[0][1].map((s) => s.label);
  for (const [, group] of systems) {
    if (group.every((s) => s.label)) {
      expectedLabels = group.map((s) => s.label);
      break;
    }
  }

  const mismatches: LabelConsistencyResult['mismatches'] = [];
  for (const [, group] of systems) {
    const labels = group.map((s) => s.label);
    const isDifferent =
      labels.length !== expectedLabels.length ||
      labels.some((l, i) => l !== expectedLabels[i]);
    if (isDifferent) {
      mismatches.push({
        pageIndex: group[0].pageIndex,
        systemIndex: group[0].systemIndex,
        labels,
      });
    }
  }

  return { isConsistent: mismatches.length === 0, expectedLabels, mismatches };
}

export function getStaffStepValidations(staffs: Staff[]): ValidationMessage[] {
  const result = validateStaffCountConsistency(staffs);
  if (result.isConsistent) {
    return [{ severity: 'success', messageKey: 'validation.staffCountMatch' }];
  }
  return [{
    severity: 'warning',
    messageKey: 'validation.staffCountMismatch',
    messageParams: { mismatchCount: result.mismatches.length },
  }];
}

export function getLabelStepValidations(staffs: Staff[]): ValidationMessage[] {
  const messages: ValidationMessage[] = [];

  const { unlabeledCount, totalCount } = validateLabelCompleteness(staffs);
  if (unlabeledCount > 0) {
    messages.push({
      severity: 'warning',
      messageKey: 'validation.unlabeledStaffs',
      messageParams: { count: unlabeledCount, total: totalCount },
    });
  }

  const dupes = validateDuplicateLabelsInSystems(staffs);
  if (dupes.length > 0) {
    messages.push({
      severity: 'warning',
      messageKey: 'validation.duplicateLabels',
      messageParams: { systemCount: dupes.length },
    });
  }

  const consistency = validateLabelConsistency(staffs);
  if (!consistency.isConsistent) {
    messages.push({
      severity: 'warning',
      messageKey: 'validation.labelOrderMismatch',
      messageParams: { mismatchCount: consistency.mismatches.length },
    });
  }

  if (messages.length === 0) {
    messages.push({ severity: 'success', messageKey: 'validation.labelsComplete' });
  }

  return messages;
}

export function derivePartsFromStaffs(staffs: Staff[]): Part[] {
  const partMap = new Map<string, Staff[]>();

  for (const staff of staffs) {
    if (!staff.label) continue;
    const existing = partMap.get(staff.label) ?? [];
    existing.push(staff);
    partMap.set(staff.label, existing);
  }

  const parts: Part[] = [];
  for (const [label, staffs] of partMap) {
    const sorted = staffs.slice().sort((a, b) => {
      if (a.pageIndex !== b.pageIndex) return a.pageIndex - b.pageIndex;
      if (a.systemIndex !== b.systemIndex) return a.systemIndex - b.systemIndex;
      return b.top - a.top;
    });
    parts.push({ label, staffs: sorted });
  }

  return parts;
}
