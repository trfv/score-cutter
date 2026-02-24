import { createContext } from 'react';
import type { Dispatch } from 'react';
import type { Staff, System, PageDimension } from '../core/staffModel';
import type { PDFDocumentProxy } from 'pdfjs-dist';

export type WizardStep = 'import' | 'systems' | 'staffs' | 'label' | 'export';

export interface ProjectState {
  step: WizardStep;
  sourceFileName: string;
  sourcePdfBytes: Uint8Array | null;
  pdfDocument: PDFDocumentProxy | null;
  pageCount: number;
  pageDimensions: PageDimension[];
  staffs: Staff[];
  systems: System[];
  currentPageIndex: number;
}

export type ProjectAction =
  | { type: 'SET_STEP'; step: WizardStep }
  | {
      type: 'LOAD_PDF';
      fileName: string;
      pdfBytes: Uint8Array;
      document: PDFDocumentProxy;
      pageCount: number;
      pageDimensions: PageDimension[];
    }
  | { type: 'SET_STAFFS'; staffs: Staff[] }
  | { type: 'SET_STAFFS_AND_SYSTEMS'; staffs: Staff[]; systems: System[] }
  | { type: 'SET_SYSTEMS'; systems: System[] }
  | { type: 'UPDATE_STAFF'; staff: Staff }
  | { type: 'ADD_STAFF'; staff: Staff }
  | { type: 'DELETE_STAFF'; staffId: string }
  | { type: 'SET_CURRENT_PAGE'; pageIndex: number }
  | { type: 'RESET' }
  | { type: 'UNDO' }
  | { type: 'REDO' };

export const initialState: ProjectState = {
  step: 'import',
  sourceFileName: '',
  sourcePdfBytes: null,
  pdfDocument: null,
  pageCount: 0,
  pageDimensions: [],
  staffs: [],
  systems: [],
  currentPageIndex: 0,
};

interface UndoRedoState {
  canUndo: boolean;
  canRedo: boolean;
}

export const ProjectContext = createContext<ProjectState>(initialState);
export const ProjectDispatchContext = createContext<Dispatch<ProjectAction>>(() => {});
export const UndoRedoContext = createContext<UndoRedoState>({ canUndo: false, canRedo: false });
