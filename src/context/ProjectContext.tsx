import { useReducer, useMemo } from 'react';
import type { ReactNode } from 'react';
import {
  ProjectContext,
  ProjectDispatchContext,
  UndoRedoContext,
  initialState,
} from './projectContextDefs';
import type { ProjectState, ProjectAction } from './projectContextDefs';
import type { Staff } from '../core/staffModel';
import {
  createHistory,
  pushState,
  undo as undoHistory,
  redo as redoHistory,
  canUndo,
  canRedo,
} from '../core/undoHistory';
import type { UndoHistory } from '../core/undoHistory';

export type { WizardStep } from './projectContextDefs';

const STAFF_ACTIONS = new Set([
  'SET_STAFFS',
  'UPDATE_STAFF',
  'ADD_STAFF',
  'DELETE_STAFF',
]);

const MAX_UNDO = 50;

function projectReducer(state: ProjectState, action: ProjectAction): ProjectState {
  switch (action.type) {
    case 'SET_STEP':
      return { ...state, step: action.step };
    case 'LOAD_PDF':
      return {
        ...state,
        sourceFileName: action.fileName,
        sourcePdfBytes: action.pdfBytes,
        pdfDocument: action.document,
        pageCount: action.pageCount,
        pageDimensions: action.pageDimensions,
        staffs: [],
        currentPageIndex: 0,
      };
    case 'SET_STAFFS':
      return { ...state, staffs: action.staffs };
    case 'UPDATE_STAFF':
      return {
        ...state,
        staffs: state.staffs.map((s) =>
          s.id === action.staff.id ? action.staff : s,
        ),
      };
    case 'ADD_STAFF':
      return { ...state, staffs: [...state.staffs, action.staff] };
    case 'DELETE_STAFF':
      return {
        ...state,
        staffs: state.staffs.filter((s) => s.id !== action.staffId),
      };
    case 'SET_CURRENT_PAGE':
      return { ...state, currentPageIndex: action.pageIndex };
    case 'RESET':
      return initialState;
    default:
      return state;
  }
}

interface CombinedState {
  project: ProjectState;
  history: UndoHistory<Staff[]>;
}

function combinedReducer(state: CombinedState, action: ProjectAction): CombinedState {
  if (action.type === 'UNDO') {
    const newHistory = undoHistory(state.history);
    if (newHistory === state.history) return state;
    return {
      project: { ...state.project, staffs: newHistory.present },
      history: newHistory,
    };
  }

  if (action.type === 'REDO') {
    const newHistory = redoHistory(state.history);
    if (newHistory === state.history) return state;
    return {
      project: { ...state.project, staffs: newHistory.present },
      history: newHistory,
    };
  }

  if (action.type === 'RESET') {
    return {
      project: initialState,
      history: createHistory<Staff[]>([]),
    };
  }

  const newProject = projectReducer(state.project, action);

  if (action.type === 'LOAD_PDF') {
    return {
      project: newProject,
      history: createHistory<Staff[]>(newProject.staffs),
    };
  }

  if (STAFF_ACTIONS.has(action.type)) {
    return {
      project: newProject,
      history: pushState(state.history, newProject.staffs, MAX_UNDO),
    };
  }

  return { project: newProject, history: state.history };
}

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [{ project, history }, dispatch] = useReducer(combinedReducer, {
    project: initialState,
    history: createHistory<Staff[]>([]),
  });

  const undoRedoState = useMemo(
    () => ({ canUndo: canUndo(history), canRedo: canRedo(history) }),
    [history],
  );

  return (
    <ProjectContext.Provider value={project}>
      <UndoRedoContext.Provider value={undoRedoState}>
        <ProjectDispatchContext.Provider value={dispatch}>
          {children}
        </ProjectDispatchContext.Provider>
      </UndoRedoContext.Provider>
    </ProjectContext.Provider>
  );
}
