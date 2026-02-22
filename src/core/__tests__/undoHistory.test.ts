import { describe, it, expect } from 'vitest';
import {
  createHistory,
  pushState,
  undo,
  redo,
  canUndo,
  canRedo,
  clearHistory,
} from '../undoHistory';

describe('undoHistory', () => {
  describe('createHistory', () => {
    it('should create history with present and empty past/future', () => {
      const h = createHistory<number[]>([]);
      expect(h.present).toEqual([]);
      expect(h.past).toEqual([]);
      expect(h.future).toEqual([]);
    });
  });

  describe('pushState', () => {
    it('should push present to past and set new present', () => {
      const h0 = createHistory<number[]>([1]);
      const h1 = pushState(h0, [1, 2]);
      expect(h1.present).toEqual([1, 2]);
      expect(h1.past).toEqual([[1]]);
      expect(h1.future).toEqual([]);
    });

    it('should clear future when new state is pushed', () => {
      let h = createHistory([1]);
      h = pushState(h, [2]);
      h = undo(h);
      // now: past=[], present=[1], future=[[2]]
      h = pushState(h, [3]);
      expect(h.present).toEqual([3]);
      expect(h.past).toEqual([[1]]);
      expect(h.future).toEqual([]);
    });

    it('should drop oldest past entry when past exceeds maxSize', () => {
      let h = createHistory(0);
      for (let i = 1; i <= 55; i++) {
        h = pushState(h, i, 50);
      }
      expect(h.past.length).toBe(50);
      expect(h.past[0]).toBe(5);
      expect(h.present).toBe(55);
    });
  });

  describe('undo', () => {
    it('should move present to future and pop past to present', () => {
      let h = createHistory<number[]>([1]);
      h = pushState(h, [2]);
      h = pushState(h, [3]);
      h = undo(h);
      expect(h.present).toEqual([2]);
      expect(h.past).toEqual([[1]]);
      expect(h.future).toEqual([[3]]);
    });

    it('should return same history when undoing with empty past', () => {
      const h = createHistory([1]);
      const result = undo(h);
      expect(result).toBe(h);
    });
  });

  describe('redo', () => {
    it('should move future[0] to present and push present to past', () => {
      let h = createHistory<number[]>([1]);
      h = pushState(h, [2]);
      h = pushState(h, [3]);
      h = undo(h);
      h = undo(h);
      h = redo(h);
      expect(h.present).toEqual([2]);
      expect(h.past).toEqual([[1]]);
      expect(h.future).toEqual([[3]]);
    });

    it('should return same history when redoing with empty future', () => {
      const h = createHistory([1]);
      const result = redo(h);
      expect(result).toBe(h);
    });
  });

  describe('canUndo / canRedo', () => {
    it('should report canUndo and canRedo correctly', () => {
      let h = createHistory(0);
      expect(canUndo(h)).toBe(false);
      expect(canRedo(h)).toBe(false);

      h = pushState(h, 1);
      expect(canUndo(h)).toBe(true);
      expect(canRedo(h)).toBe(false);

      h = undo(h);
      expect(canUndo(h)).toBe(false);
      expect(canRedo(h)).toBe(true);
    });
  });

  describe('clearHistory', () => {
    it('should clear past and future, keeping present', () => {
      let h = createHistory(0);
      h = pushState(h, 1);
      h = pushState(h, 2);
      h = undo(h);
      h = clearHistory(h);
      expect(h.present).toBe(1);
      expect(h.past).toEqual([]);
      expect(h.future).toEqual([]);
    });
  });
});
