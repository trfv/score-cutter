# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server (http://localhost:5173)
npm run build        # Type-check (tsc -b) + Vite production build
npm test             # Run all unit tests (vitest run)
npm run test:watch   # Vitest in watch mode
npm run test:e2e     # Playwright end-to-end tests
npm run lint         # ESLint
npm run knip         # Detect unused code/dependencies
```

Run a single test file: `npx vitest run src/core/__tests__/geometry.test.ts`

Pre-commit hook (.githooks/pre-commit) runs knip → eslint → tsc -b. All three must pass.

## Architecture

Partifi extracts individual instrument parts from orchestral full-score PDFs. It runs entirely in the browser with no backend.

### 5-Step Wizard Flow

Import → Detect → Label → Preview → Export

Each step is a React component in `src/components/` rendered by `App.tsx` based on the current `WizardStep`.

### Core Domain (`src/core/`)

Pure functions with no React dependencies. This is where all domain logic lives:

- **staffModel.ts** — `Staff`, `Part`, `PageDimension` types; `derivePartsFromStaffs()` groups staffs by label
- **separatorModel.ts** — `Separator` type; `computeSeparators()` derives separator lines from staffs; `applySeparatorDrag()`, `splitStaffAtPosition()`, `mergeSeparator()`, `addStaffAtPosition()` for editing
- **staffDetector.ts** — Horizontal projection algorithm to detect staff/system boundaries from binary image data
- **imageProcessing.ts** — Grayscale → binary → horizontal projection pipeline
- **coordinateMapper.ts** — Bidirectional Canvas ↔ PDF coordinate conversion (scale = DPI / 72)
- **partAssembler.ts** — Uses pdf-lib `embedPage()` with bounding boxes to extract parts as vector PDFs (no rasterization)
- **pdfLoader.ts** — pdfjs-dist wrapper for loading and rendering pages
- **undoHistory.ts** — Generic undo/redo stack (MAX_UNDO = 50)

### State Management (`src/context/`)

useReducer + React Context split into three contexts:
- **ProjectContext** (read state) / **ProjectDispatchContext** (dispatch actions) / **UndoRedoContext** (canUndo/canRedo flags)
- Only staff-mutation actions (SET_STAFFS, UPDATE_STAFF, ADD_STAFF, DELETE_STAFF) push to undo history
- Action types defined in `projectContextDefs.ts`, reducer in `ProjectContext.tsx`, consumer hooks in `projectHooks.ts`

### Web Workers (`src/workers/`)

Worker pool (size = `navigator.hardwareConcurrency || 4`) parallelizes per-page staff detection. Falls back to main thread if Workers are unavailable. Protocol types in `workerProtocol.ts`.

### Detection Pipeline

PDF page → Canvas @ 150 DPI → grayscale → binary (threshold=128) → horizontal projection → gap detection (20px min) → Staff objects with systemIndex

### PDF Assembly

pdf-lib `embedPage()` preserves vector quality and text selectability. Auto-paginates to A4 with configurable margins.

## Domain Language

See `docs/ubiquitous-language.md` for the full glossary. Key terms:

- **Staff (譜表)** — A rectangular region on a page representing one instrument's notation, defined by top/bottom in PDF Y coordinates.
- **System (組段)** — A vertical group of all parts on a page. Separated by large gaps (≥50px). A page typically has 1–3 systems.
- **Part (パート)** — All staffs with the same label across all pages, assembled into one output PDF.
- **Gap** — Whitespace between staffs detected via horizontal projection. System gaps (≥50px) separate systems; part gaps (≥15px) separate staffs within a system.
- **Full Score (総譜)** — The source PDF containing all instruments.
- **Part Score (パート譜)** — The extracted single-instrument PDF output.
- **Separator (区切り線)** — A horizontal line between staffs (or at page edges) that can be dragged to resize staffs. Part separators sit between adjacent staffs; edge separators mark the top/bottom of the first/last staff. Defined in `separatorModel.ts`.

## Key Conventions

- **Staff coordinates** use PDF coordinate space (origin bottom-left, Y increases upward). Canvas coordinates are converted via `coordinateMapper.ts`.
- **Structural vs behavioral commits** — separate code rearrangement from functionality changes.
- **CSS Modules** — each component has a co-located `.module.css` file, imported as `styles`.
- **i18n** — Japanese (default) and English via i18next. Keys in `src/i18n/ja.json` and `src/i18n/en.json`.
- **TypeScript strict mode** — `noUnusedLocals` and `noUnusedParameters` enforced.
- **ESLint flat config** (v9) in `eslint.config.js`.
