import { useReducer, useMemo } from 'react';
import type { ReactNode } from 'react';
import {
  ProjectContext,
  ProjectDispatchContext,
  UndoRedoContext,
  initialState,
} from './projectContextDefs';
import type { ProjectState, ProjectAction } from './projectContextDefs';
import type { Segment } from '../core/segmentModel';
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

const SEGMENT_ACTIONS = new Set([
  'SET_SEGMENTS',
  'UPDATE_SEGMENT',
  'ADD_SEGMENT',
  'DELETE_SEGMENT',
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
        segments: [],
        currentPageIndex: 0,
      };
    case 'SET_SEGMENTS':
      return { ...state, segments: action.segments };
    case 'UPDATE_SEGMENT':
      return {
        ...state,
        segments: state.segments.map((s) =>
          s.id === action.segment.id ? action.segment : s,
        ),
      };
    case 'ADD_SEGMENT':
      return { ...state, segments: [...state.segments, action.segment] };
    case 'DELETE_SEGMENT':
      return {
        ...state,
        segments: state.segments.filter((s) => s.id !== action.segmentId),
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
  history: UndoHistory<Segment[]>;
}

function combinedReducer(state: CombinedState, action: ProjectAction): CombinedState {
  if (action.type === 'UNDO') {
    const newHistory = undoHistory(state.history);
    if (newHistory === state.history) return state;
    return {
      project: { ...state.project, segments: newHistory.present },
      history: newHistory,
    };
  }

  if (action.type === 'REDO') {
    const newHistory = redoHistory(state.history);
    if (newHistory === state.history) return state;
    return {
      project: { ...state.project, segments: newHistory.present },
      history: newHistory,
    };
  }

  if (action.type === 'RESET') {
    return {
      project: initialState,
      history: createHistory<Segment[]>([]),
    };
  }

  const newProject = projectReducer(state.project, action);

  if (action.type === 'LOAD_PDF') {
    return {
      project: newProject,
      history: createHistory<Segment[]>(newProject.segments),
    };
  }

  if (SEGMENT_ACTIONS.has(action.type)) {
    return {
      project: newProject,
      history: pushState(state.history, newProject.segments, MAX_UNDO),
    };
  }

  return { project: newProject, history: state.history };
}

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [{ project, history }, dispatch] = useReducer(combinedReducer, {
    project: initialState,
    history: createHistory<Segment[]>([]),
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
