# Score Cutter Tutorial

Score Cutter is a browser application that automatically extracts individual instrument parts from orchestral or choral full-score PDFs. The workflow is completed in 5 steps.

## Requirements

- Modern browser (Chrome / Edge / Firefox / Safari)
- A full-score PDF file

---

## Step 1: Import

![Import screen](images/tutorial/01-import.png)

When you open the app, the PDF upload screen is displayed.

- **Drag & drop** a PDF file onto the drop zone, or click to select a file
- Once loaded, the app automatically advances to the "Systems" step

---

## Step 2: Systems

![Systems detection](images/tutorial/02-systems-detected.png)

A System is a vertical group of all parts on a page. Typically, a page has 1–3 systems.

- **Auto-detection**: System boundaries are automatically detected using horizontal projection analysis
- **Page navigation**: Use "< Page X / Y >" in the toolbar center to browse pages
- **Sidebar**: The left panel shows detected systems with their PDF Y-coordinates

![Sidebar](images/tutorial/03-systems-sidebar.png)

### Editing Systems

- **Drag boundary**: Move system boundaries up or down
- **Double-click (inside system)**: Split a system into two
- **Double-click (on boundary)**: Merge adjacent systems

Click "**Next**" when ready.

---

## Step 3: Staffs

![Staffs detection](images/tutorial/04-staffs-detected.png)

Individual staffs within each system are automatically detected.

- **Toolbar**: Shows staff counts per system and validation (staff count consistency check)
- **Sidebar**: Staffs are listed grouped by system

![Staff selected](images/tutorial/05-staffs-selected.png)

- **Click sidebar row**: The corresponding staff is highlighted on the canvas
- **Drag separator**: Adjust staff top/bottom boundaries
- **Double-click (on staff)**: Split a staff into two
- **Double-click (on separator)**: Merge adjacent staffs

Click "**Next**" when ready.

---

## Step 4: Label

![Before labeling](images/tutorial/06-label-empty.png)

Assign instrument names (labels) to each staff.

1. **Type instrument names** in the sidebar input fields (e.g., Sopran 1, Alt 2, Tenor 1)

![After labeling](images/tutorial/07-label-filled.png)

2. After labeling one system, click the "**Apply to All Systems**" button
   - Labels are copied to all other systems across all pages by ordinal position

![Labels applied](images/tutorial/08-label-applied.png)

3. Check the toolbar validation indicators:
   - All staffs have labels
   - No duplicate labels within a system
   - Label order is consistent across systems

The "**Next**" button is enabled once all staffs are labeled.

---

## Step 5: Export

![Part list](images/tutorial/09-export-list.png)

The extracted parts are displayed.

- **Select a part**: Click a part name in the sidebar to preview it on the right

![Preview](images/tutorial/10-export-preview.png)

- **Individual download**: Click the "Download" button next to each part for a single PDF
- **Batch download**: Click "**Download All as ZIP**" to download all parts in a ZIP file

---

## Advanced Operations

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Tab` | Focus next separator |
| `↑` / `↓` | Move separator by 1px |
| `Shift + ↑` / `Shift + ↓` | Move separator by 10px |
| `Delete` / `Backspace` | Merge/delete staff |
| `Escape` | Deselect |
| `Ctrl/Cmd + Z` | Undo |
| `Ctrl/Cmd + Y` | Redo |

### Theme & Language

![Header controls](images/tutorial/11-header-controls.png)

Use the buttons on the right side of the header:

- **Theme toggle**: Click the sun/moon icon to switch between dark and light modes

![Light theme](images/tutorial/12-light-theme.png)

- **Language**: Use the dropdown to switch between Japanese and English
