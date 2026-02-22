import { createContext } from 'react';
import type { Dispatch } from 'react';
import type { Staff, PageDimension } from '../core/staffModel';
import type { PDFDocumentProxy } from 'pdfjs-dist';

export type WizardStep = 'import' | 'detect' | 'label' | 'preview' | 'export';

export interface ProjectState {
  step: WizardStep;
  sourceFileName: string;
  sourcePdfBytes: Uint8Array | null;
  pdfDocument: PDFDocumentProxy | null;
  pageCount: number;
  pageDimensions: PageDimension[];
  staffs: Staff[];
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
  currentPageIndex: 0,
};

interface UndoRedoState {
  canUndo: boolean;
  canRedo: boolean;
}

export const ProjectContext = createContext<ProjectState>(initialState);
export const ProjectDispatchContext = createContext<Dispatch<ProjectAction>>(() => {});
export const UndoRedoContext = createContext<UndoRedoState>({ canUndo: false, canRedo: false });
