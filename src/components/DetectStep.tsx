import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { v4 as uuidv4 } from 'uuid';
import { useProject, useProjectDispatch } from '../context/projectHooks';
import { PageCanvas } from './PageCanvas';
import { SeparatorOverlay } from './SeparatorOverlay';
import { canvasYToPdfY } from '../core/coordinateMapper';
import { getScale } from '../core/coordinateMapper';
import { applySeparatorDrag, splitStaffAtPosition, mergeSeparator, computeSeparators, addStaffAtPosition } from '../core/separatorModel';
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
  const [selectedSeparatorIndex, setSelectedSeparatorIndex] = useState<number | null>(null);
  const [bitmapWidth, setBitmapWidth] = useState(0);
  const [canvasWidth, setCanvasWidth] = useState(0);
  const [canvasHeight, setCanvasHeight] = useState(0);

  const { pdfDocument, currentPageIndex, pageCount, pageDimensions, staffs } = project;

  const displayRatio = bitmapWidth > 0 ? canvasWidth / bitmapWidth : 1;
  const effectiveScale = DETECT_SCALE * displayRatio;

  const handleCanvasReady = useCallback((canvas: HTMLCanvasElement) => {
    setBitmapWidth(canvas.width);
    setCanvasWidth(canvas.clientWidth);
    setCanvasHeight(canvas.clientHeight);
  }, []);

  const handleDetect = useCallback(async () => {
    if (!pdfDocument) return;
    if (staffs.length > 0) {
      if (!window.confirm(t('detect.confirmOverwrite'))) return;
    }
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
              systemGapHeight: 50,
              partGapHeight: 15,
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
            systemGapHeight: 50,
            partGapHeight: 15,
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
  }, [pdfDocument, pageCount, pageDimensions, staffs.length, t, dispatch]);

  const handleSeparatorDrag = useCallback(
    (separatorIndex: number, newCanvasY: number) => {
      const dim = pageDimensions[currentPageIndex];
      if (!dim) return;
      const pageStaffs = staffs.filter((s) => s.pageIndex === currentPageIndex);
      const updated = applySeparatorDrag(
        staffs, separatorIndex, newCanvasY, pageStaffs, dim.height, effectiveScale, 10,
      );
      dispatch({ type: 'SET_STAFFS', staffs: updated });
    },
    [staffs, currentPageIndex, pageDimensions, effectiveScale, dispatch],
  );

  const handleSplitAtPosition = useCallback(
    (staffId: string, canvasY: number) => {
      const dim = pageDimensions[currentPageIndex];
      if (!dim) return;
      const pdfY = canvasYToPdfY(canvasY, dim.height, effectiveScale);
      const updated = splitStaffAtPosition(staffs, staffId, pdfY);
      dispatch({ type: 'SET_STAFFS', staffs: updated });
    },
    [staffs, currentPageIndex, pageDimensions, effectiveScale, dispatch],
  );

  const handleMergeSeparator = useCallback(
    (separatorIndex: number) => {
      const dim = pageDimensions[currentPageIndex];
      if (!dim) return;
      const pageStaffs = staffs.filter((s) => s.pageIndex === currentPageIndex);
      const { separators } = computeSeparators(pageStaffs, dim.height, effectiveScale);
      const sep = separators[separatorIndex];
      if (!sep || !sep.staffAboveId || !sep.staffBelowId) return;
      const updated = mergeSeparator(staffs, sep.staffAboveId, sep.staffBelowId);
      dispatch({ type: 'SET_STAFFS', staffs: updated });
    },
    [staffs, currentPageIndex, pageDimensions, effectiveScale, dispatch],
  );

  const handleDeleteStaff = useCallback(
    (staffId: string) => {
      dispatch({ type: 'DELETE_STAFF', staffId });
    },
    [dispatch],
  );

  const handleAddStaff = useCallback(
    (canvasY: number) => {
      const dim = pageDimensions[currentPageIndex];
      if (!dim) return;
      const pdfY = canvasYToPdfY(canvasY, dim.height, effectiveScale);
      const updated = addStaffAtPosition(staffs, currentPageIndex, pdfY, dim.height);
      dispatch({ type: 'SET_STAFFS', staffs: updated });
    },
    [staffs, currentPageIndex, pageDimensions, effectiveScale, dispatch],
  );

  // Del/Backspace key for separator deletion (merge adjacent staffs)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedSeparatorIndex !== null) {
          handleMergeSeparator(selectedSeparatorIndex);
          setSelectedSeparatorIndex(null);
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedSeparatorIndex, handleMergeSeparator]);

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
        <span className={styles.staffCount}>
          {t('detect.staffCount', { count: pageStaffs.length })}
        </span>
      </div>

      <div className={styles.canvasContainer}>
        <PageCanvas
          document={pdfDocument}
          pageIndex={currentPageIndex}
          scale={DETECT_SCALE}
          onCanvasReady={handleCanvasReady}
        />
        {currentDimension && !detecting && (
          <SeparatorOverlay
            staffs={staffs}
            pageIndex={currentPageIndex}
            pdfPageHeight={currentDimension.height}
            scale={effectiveScale}
            canvasWidth={canvasWidth}
            canvasHeight={canvasHeight}
            selectedStaffId={selectedStaffId}
            onSelectStaff={setSelectedStaffId}
            selectedSeparatorIndex={selectedSeparatorIndex}
            onSelectSeparator={setSelectedSeparatorIndex}
            onSeparatorDrag={handleSeparatorDrag}
            onSplitAtPosition={handleSplitAtPosition}
            onMergeSeparator={handleMergeSeparator}
            onDeleteStaff={handleDeleteStaff}
            onAddStaff={handleAddStaff}
          />
        )}
        {detecting && (
          <div className={styles.progressOverlay}>
            {progress
              ? t('detect.progress', { completed: progress.completed, total: progress.total })
              : t('detect.detecting')}
          </div>
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
