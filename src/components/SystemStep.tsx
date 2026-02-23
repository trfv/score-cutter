import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { v4 as uuidv4 } from 'uuid';
import { useProject, useProjectDispatch } from '../context/projectHooks';
import { PageCanvas } from './PageCanvas';
import { SystemOverlay } from './SystemOverlay';
import { canvasYToPdfY, getScale } from '../core/coordinateMapper';
import {
  splitSystemAtPosition,
  mergeAdjacentSystems,
  reassignStaffsByDrag,
} from '../core/separatorModel';
import { runDetectionPipeline } from '../workers/detectionPipeline';
import { createWorkerPool, isWorkerAvailable } from '../workers/workerPool';
import type { SystemBoundary } from '../core/staffDetector';
import type { Staff } from '../core/staffModel';
import { StepToolbar } from './StepToolbar';
import styles from './SystemStep.module.css';

const DETECT_DPI = 150;
const DETECT_SCALE = getScale(DETECT_DPI);

export function SystemStep() {
  const { t } = useTranslation();
  const project = useProject();
  const dispatch = useProjectDispatch();
  const [detecting, setDetecting] = useState(false);
  const [progress, setProgress] = useState<{ completed: number; total: number } | null>(null);
  const [selectedSystemSepIndex, setSelectedSystemSepIndex] = useState<number | null>(null);
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

      // Phase 2: Process pages via workers or main thread
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
  }, [pdfDocument, pageCount, pageDimensions, dispatch]);

  // Auto-detect on mount when no staffs exist yet
  const hasTriggeredRef = useRef(false);
  useEffect(() => {
    if (pdfDocument && staffs.length === 0 && !hasTriggeredRef.current) {
      hasTriggeredRef.current = true;
      handleDetect();
    }
  }, [pdfDocument, staffs.length, handleDetect]);

  const handleSystemSepDrag = useCallback(
    (systemSepIndex: number, newCanvasY: number) => {
      const dim = pageDimensions[currentPageIndex];
      if (!dim) return;
      const updated = reassignStaffsByDrag(
        staffs, currentPageIndex, systemSepIndex, newCanvasY, dim.height, effectiveScale,
      );
      dispatch({ type: 'SET_STAFFS', staffs: updated });
    },
    [staffs, currentPageIndex, pageDimensions, effectiveScale, dispatch],
  );

  const handleSplitSystem = useCallback(
    (canvasY: number) => {
      const dim = pageDimensions[currentPageIndex];
      if (!dim) return;
      const pdfY = canvasYToPdfY(canvasY, dim.height, effectiveScale);
      const updated = splitSystemAtPosition(staffs, currentPageIndex, pdfY);
      dispatch({ type: 'SET_STAFFS', staffs: updated });
    },
    [staffs, currentPageIndex, pageDimensions, effectiveScale, dispatch],
  );

  const handleMergeSystem = useCallback(
    (upperSystemIndex: number) => {
      const updated = mergeAdjacentSystems(staffs, currentPageIndex, upperSystemIndex);
      dispatch({ type: 'SET_STAFFS', staffs: updated });
    },
    [staffs, currentPageIndex, dispatch],
  );


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

  const handleGoToStaffs = useCallback(() => {
    dispatch({ type: 'SET_STEP', step: 'staffs' });
  }, [dispatch]);

  const handleBack = useCallback(() => {
    dispatch({ type: 'SET_STEP', step: 'import' });
  }, [dispatch]);

  const currentPageSystems = useMemo(() => {
    const bySystem = new Map<number, Staff[]>();
    for (const s of staffs) {
      if (s.pageIndex !== currentPageIndex) continue;
      if (!bySystem.has(s.systemIndex)) bySystem.set(s.systemIndex, []);
      bySystem.get(s.systemIndex)!.push(s);
    }
    return [...bySystem.entries()]
      .sort(([a], [b]) => a - b)
      .map(([systemIndex, stfs]) => {
        const sorted = stfs.slice().sort((a, b) => b.top - a.top);
        return {
          systemIndex,
          staffs: sorted,
          top: sorted[0].top,
          bottom: sorted[sorted.length - 1].bottom,
        };
      });
  }, [staffs, currentPageIndex]);

  if (!pdfDocument) return null;

  const currentDimension = pageDimensions[currentPageIndex];
  const pageStaffs = staffs.filter((s) => s.pageIndex === currentPageIndex);

  return (
    <div className={styles.container}>
      <StepToolbar
        onBack={handleBack}
        onNext={handleGoToStaffs}
        nextDisabled={staffs.length === 0}
        pageNav={{
          currentPage: currentPageIndex,
          totalPages: pageCount,
          onPrevPage: handlePrevPage,
          onNextPage: handleNextPage,
        }}
      >
        <span className={styles.staffCount}>
          {t('detect.systemCount', { count: new Set(pageStaffs.map((s) => s.systemIndex)).size })}
        </span>
      </StepToolbar>

      <div className={styles.content}>
        <aside className={styles.sidebar}>
          <h3>{t('sidebar.systemStructure')}</h3>
          {currentPageSystems.length === 0 ? (
            <p className={styles.emptyMessage}>{t('sidebar.noStaffsOnPage')}</p>
          ) : (
            currentPageSystems.map((sys) => (
              <div key={sys.systemIndex} className={styles.systemSection}>
                <div className={styles.systemHeader}>
                  {t('label.systemHeader', { system: sys.systemIndex + 1 })}
                </div>
                <div className={styles.systemMeta}>
                  {t('sidebar.staffCountInSystem', { count: sys.staffs.length })}
                </div>
                <div className={styles.systemMeta}>
                  {t('sidebar.pdfYRange', {
                    top: sys.top.toFixed(1),
                    bottom: sys.bottom.toFixed(1),
                  })}
                </div>
              </div>
            ))
          )}
        </aside>

        <div className={styles.canvasArea}>
          <div className={styles.canvasContainer}>
            <PageCanvas
              document={pdfDocument}
              pageIndex={currentPageIndex}
              scale={DETECT_SCALE}
              onCanvasReady={handleCanvasReady}
            />
            {currentDimension && !detecting && (
              <SystemOverlay
                staffs={staffs}
                pageIndex={currentPageIndex}
                pdfPageHeight={currentDimension.height}
                scale={effectiveScale}
                canvasWidth={canvasWidth}
                canvasHeight={canvasHeight}
                selectedSystemSepIndex={selectedSystemSepIndex}
                onSelectSystemSep={setSelectedSystemSepIndex}
                onSystemSepDrag={handleSystemSepDrag}
                onSplitSystem={handleSplitSystem}
                onMergeSystem={handleMergeSystem}
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
        </div>
      </div>
    </div>
  );
}
