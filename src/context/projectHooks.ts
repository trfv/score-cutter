import { useContext } from 'react';
import { ProjectContext, ProjectDispatchContext, UndoRedoContext } from './projectContextDefs';

export function useProject() {
  return useContext(ProjectContext);
}

export function useProjectDispatch() {
  return useContext(ProjectDispatchContext);
}

export function useUndoRedo() {
  return useContext(UndoRedoContext);
}
