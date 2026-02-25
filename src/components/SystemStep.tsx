import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useProject, useProjectDispatch } from '../context/projectHooks';
import { useCanvasDisplaySize } from '../hooks/useCanvasDisplaySize';
import { PageCanvas } from './PageCanvas';
import { SystemOverlay } from './SystemOverlay';
import { canvasYToPdfY, getScale } from '../core/coordinateMapper';
import {
  dragSystemBoundary,
  splitSystemAtPdfY,
  mergeAdjacentSystemsOnly,
} from '../core/separatorModel';
import { runSystemDetection } from '../workers/detectionPipeline';
import { createWorkerPool, isWorkerAvailable } from '../workers/workerPool';
import type { SystemBoundaryPx } from '../core/systemDetector';
import type { DetectSystemsResponse } from '../workers/workerProtocol';
import type { System } from '../core/staffModel';
import { getPageSystems } from '../core/staffModel';
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
  const { canvasWidth, canvasHeight, effectiveScale, handleCanvasReady } = useCanvasDisplaySize();

  const { pdfDocument, currentPageIndex, pageCount, pageDimensions, systems } = project;

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
      type PageResult = { pageIndex: number; systems: SystemBoundaryPx[] };
      let results: PageResult[];

      if (isWorkerAvailable()) {
        const pool = createWorkerPool();
        try {
          const promises = pageImageData.map(({ imageData, pageIdx }) => {
            const rgbaBuffer = imageData.data.buffer.slice(0);
            return pool.submitTask({
              type: 'DETECT_SYSTEMS',
              taskId: `page-${pageIdx}`,
              pageIndex: pageIdx,
              rgbaData: rgbaBuffer,
              width: imageData.width,
              height: imageData.height,
              systemGapHeight: 50,
            }).then(result => {
              setProgress(prev => prev ? { ...prev, completed: prev.completed + 1 } : null);
              return result as DetectSystemsResponse;
            });
          });
          results = await Promise.all(promises);
        } finally {
          pool.terminate();
        }
      } else {
        results = pageImageData.map(({ imageData, pageIdx }) => {
          const result = runSystemDetection({
            rgbaData: imageData.data,
            width: imageData.width,
            height: imageData.height,
            systemGapHeight: 50,
          });
          setProgress(prev => prev ? { ...prev, completed: prev.completed + 1 } : null);
          return { pageIndex: pageIdx, systems: result.systems };
        });
      }

      // Phase 3: Convert results to Systems only (Staffs are detected in StaffStep)
      const allSystems: System[] = [];
      for (const result of results) {
        const dim = pageDimensions[result.pageIndex];
        for (const sysBoundary of result.systems) {
          allSystems.push({
            id: crypto.randomUUID(),
            pageIndex: result.pageIndex,
            top: canvasYToPdfY(sysBoundary.topPx, dim.height, DETECT_SCALE),
            bottom: canvasYToPdfY(sysBoundary.bottomPx, dim.height, DETECT_SCALE),
          });
        }
      }

      dispatch({ type: 'SET_SYSTEMS', systems: allSystems });
    } finally {
      setDetecting(false);
      setProgress(null);
    }
  }, [pdfDocument, pageCount, pageDimensions, dispatch]);

  // Auto-detect on mount when no systems exist yet
  const hasTriggeredRef = useRef(false);
  useEffect(() => {
    if (pdfDocument && systems.length === 0 && !hasTriggeredRef.current) {
      hasTriggeredRef.current = true;
      handleDetect();
    }
  }, [pdfDocument, systems.length, handleDetect]);

  const handleSystemSepDrag = useCallback(
    (systemSepIndex: number, newCanvasY: number) => {
      const dim = pageDimensions[currentPageIndex];
      if (!dim) return;
      const newPdfY = canvasYToPdfY(newCanvasY, dim.height, effectiveScale);
      const updatedSystems = dragSystemBoundary(systems, currentPageIndex, systemSepIndex, newPdfY);
      dispatch({ type: 'SET_SYSTEMS', systems: updatedSystems });
    },
    [systems, currentPageIndex, pageDimensions, effectiveScale, dispatch],
  );

  const handleSplitSystem = useCallback(
    (canvasY: number) => {
      const dim = pageDimensions[currentPageIndex];
      if (!dim) return;
      const pdfY = canvasYToPdfY(canvasY, dim.height, effectiveScale);
      const updatedSystems = splitSystemAtPdfY(systems, currentPageIndex, pdfY);
      dispatch({ type: 'SET_SYSTEMS', systems: updatedSystems });
    },
    [systems, currentPageIndex, pageDimensions, effectiveScale, dispatch],
  );

  const handleMergeSystem = useCallback(
    (upperSystemIndex: number) => {
      const updatedSystems = mergeAdjacentSystemsOnly(systems, currentPageIndex, upperSystemIndex);
      dispatch({ type: 'SET_SYSTEMS', systems: updatedSystems });
    },
    [systems, currentPageIndex, dispatch],
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
    const pageSystems = getPageSystems(systems, currentPageIndex);
    return pageSystems.map((sys, ordinal) => ({
      ordinal,
      systemId: sys.id,
      top: sys.top,
      bottom: sys.bottom,
    }));
  }, [systems, currentPageIndex]);

  if (!pdfDocument) return null;

  const currentDimension = pageDimensions[currentPageIndex];

  return (
    <div className={styles.container}>
      <StepToolbar
        onBack={handleBack}
        onNext={handleGoToStaffs}
        nextDisabled={systems.length === 0}
        pageNav={{
          currentPage: currentPageIndex,
          totalPages: pageCount,
          onPrevPage: handlePrevPage,
          onNextPage: handleNextPage,
        }}
      >
        <span className={styles.staffCount}>
          {t('detect.systemCount', { count: getPageSystems(systems, currentPageIndex).length })}
        </span>
      </StepToolbar>

      <div className={styles.content}>
        <aside className={styles.sidebar}>
          <h3>{t('sidebar.systemStructure')}</h3>
          {currentPageSystems.length === 0 ? (
            <p className={styles.emptyMessage}>{t('sidebar.noStaffsOnPage')}</p>
          ) : (
            currentPageSystems.map((sys) => (
              <div key={sys.ordinal} className={styles.systemSection}>
                <div className={styles.systemHeader}>
                  {t('label.systemHeader', { system: sys.ordinal + 1 })}
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
                systems={systems}
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
