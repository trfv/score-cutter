export interface Staff {
  id: string;
  pageIndex: number;
  top: number;
  bottom: number;
  label: string;
  systemId: string;
}

export interface System {
  id: string;
  pageIndex: number;
  top: number;
  bottom: number;
}

export interface Part {
  label: string;
  staffs: Staff[];
}

export interface PageDimension {
  width: number;
  height: number;
}

export function getPageSystems(systems: System[], pageIndex: number): System[] {
  return systems
    .filter(s => s.pageIndex === pageIndex)
    .sort((a, b) => b.top - a.top);
}

export function getSystemOrdinal(systems: System[], pageIndex: number, systemId: string): number {
  const pageSystems = getPageSystems(systems, pageIndex);
  const index = pageSystems.findIndex(s => s.id === systemId);
  return index;
}

export function buildSystemOrdinalMap(systems: System[], pageIndex: number): Map<string, number> {
  const pageSystems = getPageSystems(systems, pageIndex);
  const map = new Map<string, number>();
  for (let i = 0; i < pageSystems.length; i++) {
    map.set(pageSystems[i].id, i);
  }
  return map;
}

export function staffsMatchSystems(staffs: Staff[], systems: System[]): boolean {
  const systemIds = new Set(systems.map(s => s.id));
  return staffs.length > 0 && staffs.every(s => systemIds.has(s.systemId));
}

export function applySystemLabelsToAll(
  staffs: Staff[],
  templateSystemId: string,
): Staff[] {
  const resolvedTemplateSystemId = templateSystemId;

  const templateStaffs = resolvedTemplateSystemId
    ? staffs
        .filter((s) => s.systemId === resolvedTemplateSystemId)
        .sort((a, b) => b.top - a.top)
    : [];

  if (templateStaffs.length === 0) return staffs;

  // Pre-group and sort each system for O(1) lookup
  const grouped = new Map<string, Staff[]>();
  for (const s of staffs) {
    const group = grouped.get(s.systemId) ?? [];
    group.push(s);
    grouped.set(s.systemId, group);
  }
  for (const group of grouped.values()) {
    group.sort((a, b) => b.top - a.top);
  }

  return staffs.map((staff) => {
    if (staff.systemId === resolvedTemplateSystemId) return staff;

    const group = grouped.get(staff.systemId)!;
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
  mismatches: Array<{ pageIndex: number; systemId: string; count: number }>;
}

interface LabelConsistencyResult {
  isConsistent: boolean;
  expectedLabels: string[];
  mismatches: Array<{ pageIndex: number; systemId: string; labels: string[] }>;
}

export function validateStaffCountConsistency(staffs: Staff[]): StaffCountConsistencyResult {
  if (staffs.length === 0) {
    return { isConsistent: true, expectedCount: undefined, mismatches: [] };
  }

  const systemCounts = new Map<string, { pageIndex: number; systemId: string; count: number }>();
  for (const s of staffs) {
    const key = s.systemId;
    const entry = systemCounts.get(key);
    if (entry) {
      entry.count++;
    } else {
      systemCounts.set(key, { pageIndex: s.pageIndex, systemId: s.systemId, count: 1 });
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
    .sort((a, b) => a.pageIndex - b.pageIndex || a.systemId.localeCompare(b.systemId));

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
): Array<{ pageIndex: number; systemId: string; duplicateLabels: string[] }> {
  const grouped = new Map<string, Staff[]>();
  for (const s of staffs) {
    const key = s.systemId;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(s);
  }

  const results: Array<{ pageIndex: number; systemId: string; duplicateLabels: string[] }> = [];
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
        systemId: group[0].systemId,
        duplicateLabels: dupes,
      });
    }
  }
  return results;
}

export function validateLabelConsistency(staffs: Staff[]): LabelConsistencyResult {
  const grouped = new Map<string, Staff[]>();
  for (const s of staffs) {
    const key = s.systemId;
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
        systemId: group[0].systemId,
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

export function derivePartsFromStaffs(staffs: Staff[], systems?: System[]): Part[] {
  const partMap = new Map<string, Staff[]>();

  for (const staff of staffs) {
    if (!staff.label) continue;
    const existing = partMap.get(staff.label) ?? [];
    existing.push(staff);
    partMap.set(staff.label, existing);
  }

  const parts: Part[] = [];
  for (const [label, groupStaffs] of partMap) {
    const sorted = groupStaffs.slice().sort((a, b) => {
      if (a.pageIndex !== b.pageIndex) return a.pageIndex - b.pageIndex;
      if (systems && systems.length > 0) {
        const ordA = getSystemOrdinal(systems, a.pageIndex, a.systemId);
        const ordB = getSystemOrdinal(systems, b.pageIndex, b.systemId);
        if (ordA !== ordB) return ordA - ordB;
      } else if (a.systemId !== b.systemId) {
        return a.systemId.localeCompare(b.systemId);
      }
      return b.top - a.top;
    });
    parts.push({ label, staffs: sorted });
  }

  parts.sort((a, b) => {
    const fa = a.staffs[0];
    const fb = b.staffs[0];
    if (fa.pageIndex !== fb.pageIndex) return fa.pageIndex - fb.pageIndex;
    if (systems && systems.length > 0) {
      const ordA = getSystemOrdinal(systems, fa.pageIndex, fa.systemId);
      const ordB = getSystemOrdinal(systems, fb.pageIndex, fb.systemId);
      if (ordA !== ordB) return ordA - ordB;
    }
    return fb.top - fa.top;
  });

  return parts;
}
