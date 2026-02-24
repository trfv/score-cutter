# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Rules
AT THIS POC TIME, DO NOT USE GIT WORKTREE. USE MAIN BRANCH ONLY.

## Quick Start

```bash
npm install          # Install dependencies
npm run prepare      # Configure git hooks (.githooks/pre-commit)
npm run dev          # Start dev server (http://localhost:5173)
```

## Commands

```bash
npm run dev          # Start dev server (http://localhost:5173)
npm run build        # Type-check (tsc -b) + Vite production build
npm run preview      # Preview production build locally
npm test             # Run all unit tests (vitest run)
npm run test:coverage # Unit tests with V8 coverage (100% thresholds)
npm run test:watch   # Vitest in watch mode
npm run test:e2e     # Playwright end-to-end tests
npm run test:e2e:ui  # Playwright with interactive UI
npm run lint         # ESLint
npm run knip         # Detect unused code/dependencies
```

Run a single test file: `npx vitest run src/core/__tests__/geometry.test.ts`

Pre-commit hook (.githooks/pre-commit) runs knip → eslint → tsc -b. All three must pass.

## Architecture

Score Cutter extracts individual instrument parts from orchestral full-score PDFs. It runs entirely in the browser with no backend.

### 5-Step Wizard Flow

Import → Systems → Staffs → Label → Export

Each step is a React component in `src/components/` rendered by `App.tsx` based on the current `WizardStep`. All steps (except Import) use the shared `StepToolbar` component for unified top-bar navigation (step back/next + page navigation + step-specific actions).

### Core Domain (`src/core/`)

Pure functions with no React dependencies. This is where all domain logic lives:

- **staffModel.ts** — `Staff`, `System`, `Part`, `PageDimension` types and domain logic. `System` is a first-class entity stored in `ProjectState.systems`; `Staff.systemId` references `System.id`. Includes part derivation (`derivePartsFromStaffs`), label propagation (`applySystemLabelsToAll`), consistency check (`staffsMatchSystems`), and validation functions consumed by StaffStep/LabelStep via `getStaffStepValidations()` / `getLabelStepValidations()`.
- **separatorModel.ts** — `Separator` type and staff/system boundary editing logic (`SystemGroup`, `StaffRegion` are module-private). Staff-level functions accept and return `{ staffs, systems }` to maintain both entities atomically. Covers separator drag, staff split/merge/add, and system split/merge/reassign operations. Also provides system-only boundary operations (`dragSystemBoundary`, `splitSystemAtPdfY`, `mergeAdjacentSystemsOnly`) that modify only `System[]` without touching staffs.
- **systemDetector.ts** — Detects system boundaries from horizontal projection data; extends first/last system to page edges. Uses `projectionAnalysis.ts` utilities.
- **projectionAnalysis.ts** — Shared utilities for gap detection (`findGaps`) and content-bound calculation (`findContentBounds`) used by both system and staff detectors.
- **staffDetector.ts** — Horizontal projection algorithm to detect staff/system boundaries from binary image data
- **imageProcessing.ts** — Grayscale → binary → horizontal projection pipeline
- **coordinateMapper.ts** — Bidirectional Canvas ↔ PDF coordinate conversion (scale = DPI / 72)
- **partAssembler.ts** — Uses pdf-lib `embedPage()` with bounding boxes to extract parts as vector PDFs (no rasterization)
- **pdfLoader.ts** — pdfjs-dist wrapper for loading and rendering pages
- **geometry.ts** — Shared geometry utilities: `rectsOverlap()`, `rectContains()`, `clampValue()`, `staffHeight()` used across overlay components and models
- **zipExporter.ts** — Batch ZIP export using JSZip; assembles all part PDFs into a single `.zip` with progress callback
- **undoHistory.ts** — Generic undo/redo stack (MAX_UNDO = 50)

### State Management (`src/context/`)

useReducer + React Context split into three contexts:
- **ProjectContext** (read state) / **ProjectDispatchContext** (dispatch actions) / **UndoRedoContext** (canUndo/canRedo flags)
- Undoable actions (SET_STAFFS, SET_STAFFS_AND_SYSTEMS, SET_SYSTEMS, UPDATE_STAFF, ADD_STAFF, DELETE_STAFF) push to undo history; undo/redo snapshots contain both `staffs` and `systems` atomically via `UndoableSnapshot`
- Action types defined in `projectContextDefs.ts`, reducer in `ProjectContext.tsx`, consumer hooks (`useProject`, `useProjectDispatch`) in `projectHooks.ts`
- `ProjectContext.tsx` exports `projectReducer`, `combinedReducer`, `toSnapshot`, `UNDOABLE_ACTIONS`, `MAX_UNDO` for unit testing

### Web Workers (`src/workers/`)

- **workerPool.ts** — Worker pool (size = `navigator.hardwareConcurrency || 4`) parallelizes per-page staff detection. Falls back to main thread if Workers are unavailable.
- **detectionWorker.ts** — Worker entry point; exports `handleMessage(request, postMessage)` for testability. Module-level code wires `self.onmessage` to delegate to `handleMessage`.
- **detectionPipeline.ts** — Grayscale → binary → horizontal projection → system detection pipeline. Used by both the worker (`detectionWorker.ts`) and main thread fallback (`SystemStep.tsx`).
- **workerProtocol.ts** — Request/response type definitions for worker communication.

### Detection Pipeline

PDF page → Canvas @ 150 DPI → grayscale → binary (threshold=128) → horizontal projection → gap detection (20px min) → System entities + Staff objects (linked via `systemId`). First/last system boundaries are extended to page edges so system regions cover the full page extent.

### PDF Assembly

pdf-lib `embedPage()` preserves vector quality and text selectability. Auto-paginates to A4 with configurable margins.

### Export Step Preview

The Export step assembles part PDFs on-demand (lazy) and renders them via pdfjs-dist `PageCanvas`. Assembled bytes and `PDFDocumentProxy` instances are cached in `useRef` maps so switching between parts is instant. All `PDFDocumentProxy` instances are destroyed on unmount.

## Domain Language

See `docs/ubiquitous-language.md` for the full glossary. Key terms:

- **Staff (譜表)** — A rectangular region on a page representing one instrument's notation, defined by top/bottom in PDF Y coordinates.
- **System (組段)** — A first-class entity (`{ id, pageIndex, top, bottom }`) representing a vertical group of all parts on a page. Stored independently in `ProjectState.systems`. Staffs reference their parent system via `systemId`. A page typically has 1–3 systems.
- **Part (パート)** — All staffs with the same label across all pages, assembled into one output PDF.
- **Gap** — Whitespace between staffs detected via horizontal projection. System gaps (≥50px) separate systems; part gaps (≥15px) separate staffs within a system.
- **Full Score (総譜)** — The source PDF containing all instruments.
- **Part Score (パート譜)** — The extracted single-instrument PDF output.
- **Separator (区切り線)** — A horizontal line between staffs (or at page edges) that can be dragged or keyboard-navigated to resize staffs. Part separators sit between adjacent staffs; edge separators mark the top/bottom of the first/last staff. Keyboard: Tab to focus, ArrowUp/Down to move (Shift for 10px steps), Delete/Backspace to merge/delete. Defined in `separatorModel.ts`.

## Key Conventions

- **Staff coordinates** use PDF coordinate space (origin bottom-left, Y increases upward). Canvas coordinates are converted via `coordinateMapper.ts`.
- **Structural vs behavioral commits** — separate code rearrangement from functionality changes.
- **CSS Modules + Design Tokens** — each component has a co-located `.module.css` file, imported as `styles`. All colors, spacing, typography, and border-radius use CSS custom properties defined in `src/theme.css`. Never hardcode color values; always use `var(--token-name)`.
- **Theming** — Dark/light theme via `data-theme` attribute on `<html>`. Default is dark. Theme tokens are defined in `src/theme.css` under `[data-theme='dark']` and `[data-theme='light']` selectors. Light theme uses darker semantic colors (`--success`, `--danger`, `--info`) than dark theme for adequate contrast on bright backgrounds. Toggle logic lives in `useTheme()` hook in `App.tsx`.
- **Icons** — SVG icon components live in `src/components/Icons.tsx`. No external icon library is used. Add new icons here following the existing `Icon` wrapper pattern.
- **i18n** — Japanese (default) and English via i18next. Keys in `src/i18n/ja.json` and `src/i18n/en.json`.
- **TypeScript strict mode** — `noUnusedLocals` and `noUnusedParameters` enforced.
- **ESLint flat config** (v9) in `eslint.config.js`.
- **Keyboard accessibility** — Separators in both `SeparatorOverlay` and `SystemOverlay` are focusable (`tabIndex`, `role="separator"`) and support ArrowUp/Down (1px, Shift=10px), Delete/Backspace, and Escape. Keyboard event handling lives in each separator component's `onKeyDown`, not in document-level listeners.
- **Step layout pattern** — The root `.app` grid uses `height: 100vh` to fix the layout to the viewport, ensuring child panels scroll independently rather than the whole page. Each step uses a two-layer flex layout: a fixed `StepToolbar` at the top (via `flex-shrink: 0`) and a scrollable content area below (`flex: 1; overflow-y: auto`). The `.main` container in `App.module.css` is a flex column with `min-height: 0` to enable child scrolling. Step-specific actions can be passed as `children` to `StepToolbar`, or placed within the step's own content area (e.g., LabelStep places "Apply to All" inside the sidebar).
- **Sidebar pattern** — SystemStep, StaffStep, and LabelStep use a two-column layout: a fixed-width `sidebar` (280px) on the left and a flexible `canvasArea` (`min-width: 600px`) on the right, both independently scrollable. The sidebar displays data structure information (system groups, staff PDF coordinates, labels). In StaffStep, clicking a staff row in the sidebar syncs selection with the canvas overlay; the selected row auto-scrolls into view via `scrollIntoView({ block: 'nearest' })`.
- **LabelStep design** — The sidebar shows all systems on the current page, grouped by System entities (via `getPageSystems()`). Each system section has its own "Apply to All Systems" button that copies its labels to all other systems across all pages by ordinal position. The sidebar and canvas area scroll independently. Label application logic is a pure function `applySystemLabelsToAll()` in `staffModel.ts`.
- **Validation indicators** — `StatusIndicator` component displays `ValidationMessage[]` in the `StepToolbar` center area. StaffStep shows staff-count consistency (all systems same count); LabelStep shows label completeness, duplicate detection, and order consistency. Validation logic lives as pure functions in `staffModel.ts`; components consume via `useMemo` + `getStaffStepValidations()` / `getLabelStepValidations()`.
- **Test coverage** — `src/core/`, `src/workers/`, `src/context/` maintain 100% coverage (lines, functions, branches, statements) enforced by `test:coverage` thresholds in `vite.config.ts`. Unreachable defensive branches use `/* v8 ignore start */` / `/* v8 ignore stop */` comments.
