# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Rules
AT THIS POC TIME, DO NOT USE GIT WORKTREE. USE MASTER BRANCH ONLY.

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

Score Cutter extracts individual instrument parts from orchestral full-score PDFs. It runs entirely in the browser with no backend.

### 5-Step Wizard Flow

Import → Systems → Staffs → Label → Export

Each step is a React component in `src/components/` rendered by `App.tsx` based on the current `WizardStep`. All steps (except Import) use the shared `StepToolbar` component for unified top-bar navigation (step back/next + page navigation + step-specific actions).

### Core Domain (`src/core/`)

Pure functions with no React dependencies. This is where all domain logic lives:

- **staffModel.ts** — `Staff`, `Part`, `PageDimension` types; `derivePartsFromStaffs()` groups staffs by label; `applySystemLabelsToAll()` copies labels from a template system to all other systems by ordinal position; validation functions (`validateStaffCountConsistency()`, `validateLabelCompleteness()`, `validateDuplicateLabelsInSystems()`, `validateLabelConsistency()`) with composite helpers `getStaffStepValidations()` and `getLabelStepValidations()` returning `ValidationMessage[]` for UI display
- **separatorModel.ts** — `Separator`, `SystemGroup`, `StaffRegion` types; `computeSeparators()` derives separator lines from staffs; `computeSystemGroups()` groups staffs by system with canvas coordinates; `applySeparatorDrag()`, `splitStaffAtPosition()`, `mergeSeparator()`, `addStaffAtPosition()` for staff editing; `splitSystemAtGap()`, `mergeAdjacentSystems()`, `reassignStaffsByDrag()` for system boundary editing
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
- Action types defined in `projectContextDefs.ts`, reducer in `ProjectContext.tsx`, consumer hooks (`useProject`, `useProjectDispatch`) in `projectHooks.ts`

### Web Workers (`src/workers/`)

Worker pool (size = `navigator.hardwareConcurrency || 4`) parallelizes per-page staff detection. Falls back to main thread if Workers are unavailable. Protocol types in `workerProtocol.ts`.

### Detection Pipeline

PDF page → Canvas @ 150 DPI → grayscale → binary (threshold=128) → horizontal projection → gap detection (20px min) → Staff objects with systemIndex

### PDF Assembly

pdf-lib `embedPage()` preserves vector quality and text selectability. Auto-paginates to A4 with configurable margins.

### Export Step Preview

The Export step assembles part PDFs on-demand (lazy) and renders them via pdfjs-dist `PageCanvas`. Assembled bytes and `PDFDocumentProxy` instances are cached in `useRef` maps so switching between parts is instant. All `PDFDocumentProxy` instances are destroyed on unmount.

## Domain Language

See `docs/ubiquitous-language.md` for the full glossary. Key terms:

- **Staff (譜表)** — A rectangular region on a page representing one instrument's notation, defined by top/bottom in PDF Y coordinates.
- **System (組段)** — A vertical group of all parts on a page. Separated by large gaps (≥50px). A page typically has 1–3 systems.
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
- **Step layout pattern** — Each step uses a two-layer flex layout: a fixed `StepToolbar` at the top (via `flex-shrink: 0`) and a scrollable content area below (`flex: 1; overflow-y: auto`). The `.main` container in `App.module.css` is a flex column with `min-height: 0` to enable child scrolling. Step-specific actions can be passed as `children` to `StepToolbar`, or placed within the step's own content area (e.g., LabelStep places "Apply to All" inside the sidebar).
- **LabelStep design** — The sidebar shows all systems on the current page, grouped by `systemIndex`. Each system section has its own "Apply to All Systems" button that copies its labels to all other systems across all pages by ordinal position. The sidebar and canvas area scroll independently. Label application logic is a pure function `applySystemLabelsToAll()` in `staffModel.ts`.
- **Validation indicators** — `StatusIndicator` component displays `ValidationMessage[]` in the `StepToolbar` center area. StaffStep shows staff-count consistency (all systems same count); LabelStep shows label completeness, duplicate detection, and order consistency. Validation logic lives as pure functions in `staffModel.ts`; components consume via `useMemo` + `getStaffStepValidations()` / `getLabelStepValidations()`.
