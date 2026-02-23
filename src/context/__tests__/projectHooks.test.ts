import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useProject, useProjectDispatch } from '../projectHooks';
import { ProjectProvider } from '../ProjectContext';

describe('useProject', () => {
  it('returns initial state from ProjectProvider', () => {
    const { result } = renderHook(() => useProject(), {
      wrapper: ProjectProvider,
    });
    expect(result.current.step).toBe('import');
    expect(result.current.staffs).toEqual([]);
    expect(result.current.systems).toEqual([]);
    expect(result.current.pageCount).toBe(0);
  });
});

describe('useProjectDispatch', () => {
  it('returns a dispatch function', () => {
    const { result } = renderHook(() => useProjectDispatch(), {
      wrapper: ProjectProvider,
    });
    expect(typeof result.current).toBe('function');
  });
});
