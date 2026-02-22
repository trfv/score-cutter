import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { v4 as uuidv4 } from 'uuid';
import { useProject, useProjectDispatch, useUndoRedo } from '../context/projectHooks';
import { PageCanvas } from './PageCanvas';
import { StaffOverlay } from './StaffOverlay';
import { canvasYToPdfY } from '../core/coordinateMapper';
import { getScale } from '../core/coordinateMapper';
import { runDetectionPipeline } from '../workers/detectionPipeline';
import { createWorkerPool, isWorkerAvailable } from '../workers/workerPool';
import type { SystemBoundary } from '../core/staffDetector';
import type { Staff } from '../core/staffModel';
import styles from './DetectStep.module.css';

const DETECT_DPI = 150;
const DETECT_SCALE = getScale(DETECT_DPI);

export function DetectStep() {
  const { t } = useTranslation();
  const project = useProject();
  const dispatch = useProjectDispatch();
  const [detecting, setDetecting] = useState(false);
  const [progress, setProgress] = useState<{ completed: number; total: number } | null>(null);
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [canvasWidth, setCanvasWidth] = useState(0);
  const [systemGapHeight, setSystemGapHeight] = useState(50);
  const [partGapHeight, setPartGapHeight] = useState(15);

  const { canUndo: undoAvailable, canRedo: redoAvailable } = useUndoRedo();
  const { pdfDocument, currentPageIndex, pageCount, pageDimensions, staffs } = project;

  const displayScale = getScale(DETECT_DPI);

  const handleCanvasReady = useCallback((canvas: HTMLCanvasElement) => {
    setCanvasWidth(canvas.width);
  }, []);

  const handleDetect = useCallback(async () => {
    if (!pdfDocument) return;
    setDetecting(true);
    setProgress({ completed: 0, total: pageCount });

    try {
      // Phase 1: Render all pages to canvas on main thread, extract ImageData
      const pageImageData: Array<{ imageData: ImageData; pageIdx: number }> = [];
      for (let pageIdx = 0; pageIdx < pageCount; pageIdx++) {
        const canvas = document.createElement('canvas');
        const page = await pdfDocument.getPage(pageIdx + 1);
        const viewport = page.getViewport({ scale: DETECT_SCALE });
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvas, viewport }).promise;
        const ctx = canvas.getContext('2d');
        if (!ctx) continue;
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        pageImageData.push({ imageData, pageIdx });
      }

      // Phase 2: Process pages
      type PageResult = { pageIndex: number; systems: SystemBoundary[] };
      let results: PageResult[];

      if (isWorkerAvailable()) {
        const pool = createWorkerPool();
        try {
          const promises = pageImageData.map(({ imageData, pageIdx }) => {
            const rgbaBuffer = imageData.data.buffer.slice(0);
            return pool.submitTask({
              type: 'DETECT_PAGE',
              taskId: `page-${pageIdx}`,
              pageIndex: pageIdx,
              rgbaData: rgbaBuffer,
              width: imageData.width,
              height: imageData.height,
              systemGapHeight,
              partGapHeight,
            }).then(result => {
              setProgress(prev => prev ? { ...prev, completed: prev.completed + 1 } : null);
              return result;
            });
          });
          results = await Promise.all(promises);
        } finally {
          pool.terminate();
        }
      } else {
        // Fallback: main thread
        results = pageImageData.map(({ imageData, pageIdx }) => {
          const result = runDetectionPipeline({
            rgbaData: imageData.data,
            width: imageData.width,
            height: imageData.height,
            systemGapHeight,
            partGapHeight,
          });
          setProgress(prev => prev ? { ...prev, completed: prev.completed + 1 } : null);
          return { pageIndex: pageIdx, systems: result.systems };
        });
      }

      // Phase 3: Convert results to Staffs
      const allStaffs: Staff[] = [];
      for (const result of results) {
        const dim = pageDimensions[result.pageIndex];
        for (let sysIdx = 0; sysIdx < result.systems.length; sysIdx++) {
          for (const part of result.systems[sysIdx].parts) {
            allStaffs.push({
              id: uuidv4(),
              pageIndex: result.pageIndex,
              top: canvasYToPdfY(part.topPx, dim.height, DETECT_SCALE),
              bottom: canvasYToPdfY(part.bottomPx, dim.height, DETECT_SCALE),
              label: '',
              systemIndex: sysIdx,
            });
          }
        }
      }

      dispatch({ type: 'SET_STAFFS', staffs: allStaffs });
    } finally {
      setDetecting(false);
      setProgress(null);
    }
  }, [pdfDocument, pageCount, pageDimensions, dispatch, systemGapHeight, partGapHeight]);

  const handleBoundaryDrag = useCallback(
    (staffId: string, edge: 'top' | 'bottom', newCanvasY: number) => {
      const staff = staffs.find((s) => s.id === staffId);
      if (!staff) return;
      const dim = pageDimensions[staff.pageIndex];
      const newPdfY = canvasYToPdfY(newCanvasY, dim.height, displayScale);

      const updated = { ...staff };
      if (edge === 'top') {
        updated.top = Math.max(newPdfY, updated.bottom + 10);
      } else {
        updated.bottom = Math.min(newPdfY, updated.top - 10);
      }
      dispatch({ type: 'UPDATE_STAFF', staff: updated });
    },
    [staffs, pageDimensions, displayScale, dispatch],
  );

  const handleAddStaff = useCallback(() => {
    const dim = pageDimensions[currentPageIndex];
    const newStaff: Staff = {
      id: uuidv4(),
      pageIndex: currentPageIndex,
      top: dim.height / 2 + 50,
      bottom: dim.height / 2 - 50,
      label: '',
      systemIndex: 0,
    };
    dispatch({ type: 'ADD_STAFF', staff: newStaff });
  }, [currentPageIndex, pageDimensions, dispatch]);

  const handleDeleteStaff = useCallback(() => {
    if (selectedStaffId) {
      dispatch({ type: 'DELETE_STAFF', staffId: selectedStaffId });
      setSelectedStaffId(null);
    }
  }, [selectedStaffId, dispatch]);

  const handlePrevPage = useCallback(() => {
    if (currentPageIndex > 0) {
      dispatch({ type: 'SET_CURRENT_PAGE', pageIndex: currentPageIndex - 1 });
    }
  }, [currentPageIndex, dispatch]);

  const handleNextPage = useCallback(() => {
    if (currentPageIndex < pageCount - 1) {
      dispatch({ type: 'SET_CURRENT_PAGE', pageIndex: currentPageIndex + 1 });
    }
  }, [currentPageIndex, pageCount, dispatch]);

  const handleGoToLabel = useCallback(() => {
    dispatch({ type: 'SET_STEP', step: 'label' });
  }, [dispatch]);

  const handleBack = useCallback(() => {
    dispatch({ type: 'SET_STEP', step: 'import' });
  }, [dispatch]);

  if (!pdfDocument) return null;

  const currentDimension = pageDimensions[currentPageIndex];
  const pageStaffs = staffs.filter((s) => s.pageIndex === currentPageIndex);

  return (
    <div className={styles.container}>
      <div className={styles.toolbar}>
        <button onClick={handleDetect} disabled={detecting}>
          {detecting
            ? (progress
              ? t('detect.progress', { completed: progress.completed, total: progress.total })
              : t('detect.detecting'))
            : t('detect.detectButton')}
        </button>
        <button onClick={handleAddStaff}>{t('detect.addStaff')}</button>
        <button onClick={handleDeleteStaff} disabled={!selectedStaffId}>
          {t('detect.deleteStaff')}
        </button>
        <button onClick={() => dispatch({ type: 'UNDO' })} disabled={!undoAvailable}>
          {t('common.undo')}
        </button>
        <button onClick={() => dispatch({ type: 'REDO' })} disabled={!redoAvailable}>
          {t('common.redo')}
        </button>
        <span className={styles.info}>
          {t('detect.staffCount', { count: pageStaffs.length })}
        </span>
      </div>

      <div className={styles.toolbar}>
        <label>
          {t('detect.systemGapThreshold')}
          <input type="range" min={30} max={100} value={systemGapHeight}
                 onChange={e => setSystemGapHeight(Number(e.target.value))} />
          <span>{systemGapHeight}px</span>
        </label>
        <label>
          {t('detect.partGapThreshold')}
          <input type="range" min={5} max={40} value={partGapHeight}
                 onChange={e => setPartGapHeight(Number(e.target.value))} />
          <span>{partGapHeight}px</span>
        </label>
      </div>

      <div className={styles.pageNav}>
        <button onClick={handlePrevPage} disabled={currentPageIndex === 0}>
          &lt;
        </button>
        <span>
          {t('detect.page', {
            current: currentPageIndex + 1,
            total: pageCount,
          })}
        </span>
        <button onClick={handleNextPage} disabled={currentPageIndex >= pageCount - 1}>
          &gt;
        </button>
      </div>

      <div className={styles.canvasContainer}>
        <PageCanvas
          document={pdfDocument}
          pageIndex={currentPageIndex}
          scale={displayScale}
          onCanvasReady={handleCanvasReady}
        />
        {currentDimension && (
          <StaffOverlay
            staffs={staffs}
            pageIndex={currentPageIndex}
            pdfPageHeight={currentDimension.height}
            scale={displayScale}
            canvasWidth={canvasWidth}
            selectedStaffId={selectedStaffId}
            onSelect={setSelectedStaffId}
            onBoundaryDrag={handleBoundaryDrag}
          />
        )}
      </div>

      <div className={styles.navigation}>
        <button onClick={handleBack}>{t('common.back')}</button>
        <button onClick={handleGoToLabel} disabled={staffs.length === 0}>
          {t('common.next')}
        </button>
      </div>
    </div>
  );
}
