import { describe, it, expect } from 'vitest';
import { useContext } from 'react';
import { renderHook } from '@testing-library/react';
import {
  initialState,
  ProjectContext,
  ProjectDispatchContext,
  UndoRedoContext,
} from '../projectContextDefs';

describe('initialState', () => {
  it('has expected default values', () => {
    expect(initialState.step).toBe('import');
    expect(initialState.sourceFileName).toBe('');
    expect(initialState.sourcePdfBytes).toBeNull();
    expect(initialState.pdfDocument).toBeNull();
    expect(initialState.pageCount).toBe(0);
    expect(initialState.pageDimensions).toEqual([]);
    expect(initialState.staffs).toEqual([]);
    expect(initialState.systems).toEqual([]);
    expect(initialState.currentPageIndex).toBe(0);
  });
});

describe('contexts', () => {
  it('are defined', () => {
    expect(ProjectContext).toBeDefined();
    expect(ProjectDispatchContext).toBeDefined();
    expect(UndoRedoContext).toBeDefined();
  });

  it('default dispatch context is a callable noop', () => {
    const { result } = renderHook(() => useContext(ProjectDispatchContext));
    expect(typeof result.current).toBe('function');
    // Calling the default noop dispatch should not throw
    result.current({ type: 'RESET' });
  });
});
