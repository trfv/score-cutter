import { describe, it, expect } from 'vitest';
import {
  projectReducer,
  combinedReducer,
  toSnapshot,
  UNDOABLE_ACTIONS,
  MAX_UNDO,
} from '../ProjectContext';
import type { CombinedState } from '../ProjectContext';
import { initialState } from '../projectContextDefs';
import type { ProjectState, ProjectAction } from '../projectContextDefs';
import type { Staff, System } from '../../core/staffModel';
import { createHistory } from '../../core/undoHistory';
import type { PDFDocumentProxy } from 'pdfjs-dist';

const mockStaff: Staff = {
  id: 'staff-1',
  pageIndex: 0,
  top: 700,
  bottom: 600,
  label: 'Violin',
  systemId: 'sys-0',
};

const mockStaff2: Staff = {
  id: 'staff-2',
  pageIndex: 0,
  top: 500,
  bottom: 400,
  label: 'Cello',
  systemId: 'sys-0',
};

const mockSystem: System = {
  id: 'sys-0',
  pageIndex: 0,
  top: 700,
  bottom: 400,
};

function makeCombinedState(projectOverrides?: Partial<ProjectState>): CombinedState {
  const project = { ...initialState, ...projectOverrides };
  return {
    project,
    history: createHistory({ staffs: project.staffs, systems: project.systems }),
  };
}

describe('projectReducer', () => {
  it('SET_STEP changes step and resets currentPageIndex', () => {
    const state = { ...initialState, currentPageIndex: 3 };
    const result = projectReducer(state, { type: 'SET_STEP', step: 'label' });
    expect(result.step).toBe('label');
    expect(result.currentPageIndex).toBe(0);
  });

  it('LOAD_PDF sets all PDF-related fields', () => {
    const doc = {} as PDFDocumentProxy;
    const dims = [{ width: 595, height: 842 }];
    const bytes = new Uint8Array([1]);
    const result = projectReducer(initialState, {
      type: 'LOAD_PDF',
      fileName: 'test.pdf',
      pdfBytes: bytes,
      document: doc,
      pageCount: 1,
      pageDimensions: dims,
    });
    expect(result.sourceFileName).toBe('test.pdf');
    expect(result.sourcePdfBytes).toBe(bytes);
    expect(result.pdfDocument).toBe(doc);
    expect(result.pageCount).toBe(1);
    expect(result.pageDimensions).toBe(dims);
    expect(result.staffs).toEqual([]);
    expect(result.systems).toEqual([]);
    expect(result.currentPageIndex).toBe(0);
  });

  it('SET_STAFFS replaces staffs array', () => {
    const staffs = [mockStaff];
    const result = projectReducer(initialState, { type: 'SET_STAFFS', staffs });
    expect(result.staffs).toBe(staffs);
  });

  it('SET_STAFFS_AND_SYSTEMS replaces both', () => {
    const staffs = [mockStaff];
    const systems = [mockSystem];
    const result = projectReducer(initialState, { type: 'SET_STAFFS_AND_SYSTEMS', staffs, systems });
    expect(result.staffs).toBe(staffs);
    expect(result.systems).toBe(systems);
  });

  it('UPDATE_STAFF replaces matching staff by id', () => {
    const state = { ...initialState, staffs: [mockStaff, mockStaff2] };
    const updated = { ...mockStaff, label: 'Viola' };
    const result = projectReducer(state, { type: 'UPDATE_STAFF', staff: updated });
    expect(result.staffs[0].label).toBe('Viola');
    expect(result.staffs[1]).toBe(mockStaff2);
  });

  it('ADD_STAFF appends to staffs array', () => {
    const state = { ...initialState, staffs: [mockStaff] };
    const result = projectReducer(state, { type: 'ADD_STAFF', staff: mockStaff2 });
    expect(result.staffs).toHaveLength(2);
    expect(result.staffs[1]).toBe(mockStaff2);
  });

  it('DELETE_STAFF removes staff by id', () => {
    const state = { ...initialState, staffs: [mockStaff, mockStaff2] };
    const result = projectReducer(state, { type: 'DELETE_STAFF', staffId: 'staff-1' });
    expect(result.staffs).toHaveLength(1);
    expect(result.staffs[0].id).toBe('staff-2');
  });

  it('SET_CURRENT_PAGE updates currentPageIndex', () => {
    const result = projectReducer(initialState, { type: 'SET_CURRENT_PAGE', pageIndex: 5 });
    expect(result.currentPageIndex).toBe(5);
  });

  it('RESET returns initialState', () => {
    const state = { ...initialState, step: 'label' as const, currentPageIndex: 3 };
    const result = projectReducer(state, { type: 'RESET' });
    expect(result).toEqual(initialState);
  });

  it('SET_SYSTEMS replaces systems array leaving staffs unchanged', () => {
    const state = { ...initialState, staffs: [mockStaff], systems: [] };
    const newSystems = [mockSystem];
    const result = projectReducer(state, { type: 'SET_SYSTEMS', systems: newSystems });
    expect(result.systems).toBe(newSystems);
    expect(result.staffs).toBe(state.staffs);
  });

  it('REFRESH_DOCUMENT replaces pdfDocument without resetting other state', () => {
    const oldDoc = {} as PDFDocumentProxy;
    const newDoc = {} as PDFDocumentProxy;
    const state: ProjectState = {
      ...initialState,
      pdfDocument: oldDoc,
      staffs: [mockStaff],
      systems: [mockSystem],
      currentPageIndex: 2,
      step: 'staffs',
    };
    const result = projectReducer(state, { type: 'REFRESH_DOCUMENT', document: newDoc });
    expect(result.pdfDocument).toBe(newDoc);
    expect(result.staffs).toBe(state.staffs);
    expect(result.systems).toBe(state.systems);
    expect(result.currentPageIndex).toBe(2);
    expect(result.step).toBe('staffs');
  });

  it('unknown action type returns state unchanged', () => {
    const result = projectReducer(initialState, { type: 'UNKNOWN' } as unknown as ProjectAction);
    expect(result).toBe(initialState);
  });
});

describe('combinedReducer', () => {
  it('UNDO reverts to previous state', () => {
    const state = makeCombinedState({ staffs: [] });
    const withStaff = combinedReducer(state, { type: 'SET_STAFFS', staffs: [mockStaff] });
    const undone = combinedReducer(withStaff, { type: 'UNDO' });

    expect(undone.project.staffs).toEqual([]);
  });

  it('UNDO returns same state when nothing to undo', () => {
    const state = makeCombinedState();
    const result = combinedReducer(state, { type: 'UNDO' });
    expect(result).toBe(state);
  });

  it('REDO restores future state', () => {
    const state = makeCombinedState({ staffs: [] });
    const withStaff = combinedReducer(state, { type: 'SET_STAFFS', staffs: [mockStaff] });
    const undone = combinedReducer(withStaff, { type: 'UNDO' });
    const redone = combinedReducer(undone, { type: 'REDO' });

    expect(redone.project.staffs).toEqual([mockStaff]);
  });

  it('REDO returns same state when nothing to redo', () => {
    const state = makeCombinedState();
    const result = combinedReducer(state, { type: 'REDO' });
    expect(result).toBe(state);
  });

  it('RESET resets project and creates fresh history', () => {
    const state = makeCombinedState({ staffs: [mockStaff] });
    const result = combinedReducer(state, { type: 'RESET' });
    expect(result.project).toEqual(initialState);
    expect(result.history.present).toEqual({ staffs: [], systems: [] });
  });

  it('LOAD_PDF resets history with new snapshot', () => {
    const state = makeCombinedState({ staffs: [mockStaff] });
    const result = combinedReducer(state, {
      type: 'LOAD_PDF',
      fileName: 'test.pdf',
      pdfBytes: new Uint8Array([1]),
      document: {} as PDFDocumentProxy,
      pageCount: 1,
      pageDimensions: [{ width: 595, height: 842 }],
    });
    expect(result.project.sourceFileName).toBe('test.pdf');
    expect(result.history.past).toEqual([]);
    expect(result.history.future).toEqual([]);
  });

  it('undoable action pushes to history', () => {
    const state = makeCombinedState({ staffs: [] });
    const result = combinedReducer(state, { type: 'SET_STAFFS', staffs: [mockStaff] });
    expect(result.history.past).toHaveLength(1);
    expect(result.project.staffs).toEqual([mockStaff]);
  });

  it('non-undoable action does not push to history', () => {
    const state = makeCombinedState();
    const result = combinedReducer(state, { type: 'SET_STEP', step: 'staffs' });
    expect(result.history.past).toHaveLength(0);
    expect(result.project.step).toBe('staffs');
  });

  it('non-undoable action preserves history reference', () => {
    const state = makeCombinedState();
    const result = combinedReducer(state, { type: 'SET_CURRENT_PAGE', pageIndex: 2 });
    expect(result.history).toBe(state.history);
  });

  it('REFRESH_DOCUMENT does not push to history', () => {
    const state = makeCombinedState({ staffs: [mockStaff] });
    const result = combinedReducer(state, { type: 'REFRESH_DOCUMENT', document: {} as PDFDocumentProxy });
    expect(result.history).toBe(state.history);
    expect(result.project.pdfDocument).toBeDefined();
  });

  it('SET_SYSTEMS pushes to history and supports undo/redo', () => {
    const state = makeCombinedState({ systems: [] });
    const newSystems = [mockSystem];
    const withSystems = combinedReducer(state, { type: 'SET_SYSTEMS', systems: newSystems });
    expect(withSystems.project.systems).toEqual(newSystems);
    expect(withSystems.history.past).toHaveLength(1);

    const undone = combinedReducer(withSystems, { type: 'UNDO' });
    expect(undone.project.systems).toEqual([]);

    const redone = combinedReducer(undone, { type: 'REDO' });
    expect(redone.project.systems).toEqual(newSystems);
  });
});

describe('toSnapshot', () => {
  it('extracts staffs and systems from ProjectState', () => {
    const state = { ...initialState, staffs: [mockStaff], systems: [mockSystem] };
    const snapshot = toSnapshot(state);
    expect(snapshot).toEqual({ staffs: [mockStaff], systems: [mockSystem] });
  });
});

describe('constants', () => {
  it('UNDOABLE_ACTIONS contains expected action types', () => {
    expect(UNDOABLE_ACTIONS.has('SET_STAFFS')).toBe(true);
    expect(UNDOABLE_ACTIONS.has('SET_STAFFS_AND_SYSTEMS')).toBe(true);
    expect(UNDOABLE_ACTIONS.has('SET_SYSTEMS')).toBe(true);
    expect(UNDOABLE_ACTIONS.has('UPDATE_STAFF')).toBe(true);
    expect(UNDOABLE_ACTIONS.has('ADD_STAFF')).toBe(true);
    expect(UNDOABLE_ACTIONS.has('DELETE_STAFF')).toBe(true);
    expect(UNDOABLE_ACTIONS.has('SET_STEP')).toBe(false);
  });

  it('MAX_UNDO is 50', () => {
    expect(MAX_UNDO).toBe(50);
  });
});
