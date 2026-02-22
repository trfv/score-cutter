export interface UndoHistory<T> {
  past: T[];
  present: T;
  future: T[];
}

export function createHistory<T>(initial: T): UndoHistory<T> {
  return { past: [], present: initial, future: [] };
}

export function pushState<T>(
  history: UndoHistory<T>,
  newPresent: T,
  maxSize: number = 50,
): UndoHistory<T> {
  const newPast = [...history.past, history.present];
  if (newPast.length > maxSize) {
    newPast.splice(0, newPast.length - maxSize);
  }
  return { past: newPast, present: newPresent, future: [] };
}

export function undo<T>(history: UndoHistory<T>): UndoHistory<T> {
  if (history.past.length === 0) return history;
  const newPast = history.past.slice(0, -1);
  const newPresent = history.past[history.past.length - 1];
  return { past: newPast, present: newPresent, future: [history.present, ...history.future] };
}

export function redo<T>(history: UndoHistory<T>): UndoHistory<T> {
  if (history.future.length === 0) return history;
  const [newPresent, ...newFuture] = history.future;
  return { past: [...history.past, history.present], present: newPresent, future: newFuture };
}

export function canUndo<T>(history: UndoHistory<T>): boolean {
  return history.past.length > 0;
}

export function canRedo<T>(history: UndoHistory<T>): boolean {
  return history.future.length > 0;
}

export function clearHistory<T>(history: UndoHistory<T>): UndoHistory<T> {
  return { past: [], present: history.present, future: [] };
}
