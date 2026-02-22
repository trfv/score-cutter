import { useContext } from 'react';
import { ProjectContext, ProjectDispatchContext } from './projectContextDefs';

export function useProject() {
  return useContext(ProjectContext);
}

export function useProjectDispatch() {
  return useContext(ProjectDispatchContext);
}
