import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useProject, useProjectDispatch } from '../context/projectHooks';
import { useCanvasDisplaySize } from '../hooks/useCanvasDisplaySize';
import { PageCanvas } from './PageCanvas';
import { SeparatorOverlay } from './SeparatorOverlay';
import { StatusIndicator } from './StatusIndicator';
import { canvasYToPdfY, pdfYToCanvasY, getScale } from '../core/coordinateMapper';
import { applySeparatorDrag, splitStaffAtPosition, mergeSeparator, computeSeparators, addStaffAtPosition } from '../core/separatorModel';
import { getStaffStepValidations, getPageSystems, staffsMatchSystems } from '../core/staffModel';
import type { Staff, System } from '../core/staffModel';
import type { SystemBoundaryPx } from '../core/systemDetector';
import type { DetectStaffsResponse } from '../workers/workerProtocol';
import { runStaffDetection } from '../workers/detectionPipeline';
import { createWorkerPool, isWorkerAvailable } from '../workers/workerPool';
import { StepToolbar } from './StepToolbar';
import styles from './StaffStep.module.css';

const DETECT_DPI = 150;
const DETECT_SCALE = getScale(DETECT_DPI);

export function StaffStep() {
  const { t } = useTranslation();
  const project = useProject();
  const dispatch = useProjectDispatch();
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [selectedSeparatorIndex, setSelectedSeparatorIndex] = useState<number | null>(null);
  const [detectingStaffs, setDetectingStaffs] = useState(false);
  const { canvasWidth, canvasHeight, effectiveScale, handleCanvasReady } = useCanvasDisplaySize();

  const { pdfDocument, currentPageIndex, pageCount, pageDimensions, staffs, systems } = project;

  // Auto-detect staffs within system boundaries via Worker pool
  const handleAutoDetectStaffs = useCallback(async () => {
    if (!pdfDocument || systems.length === 0) return;
    setDetectingStaffs(true);

    try {
      // Group systems by page
      const systemsByPage = new Map<number, System[]>();
      for (const sys of systems) {
        const group = systemsByPage.get(sys.pageIndex) ?? [];
        group.push(sys);
        systemsByPage.set(sys.pageIndex, group);
      }

      // Phase 1: Render pages and build per-page system boundaries in pixel coords
      const pageData: Array<{
        pageIdx: number;
        imageData: ImageData;
        pageSystems: System[];
        systemBoundaries: SystemBoundaryPx[];
      }> = [];

      for (const [pageIdx, pageSystems] of systemsByPage) {
        const dim = pageDimensions[pageIdx];
        if (!dim) continue;

        const canvas = document.createElement('canvas');
        const page = await pdfDocument.getPage(pageIdx + 1);
        const viewport = page.getViewport({ scale: DETECT_SCALE });
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvas, viewport }).promise;
        const ctx = canvas.getContext('2d');
        if (!ctx) continue;
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        const systemBoundaries: SystemBoundaryPx[] = pageSystems.map((sys) => ({
          topPx: Math.floor(pdfYToCanvasY(sys.top, dim.height, DETECT_SCALE)),
          bottomPx: Math.ceil(pdfYToCanvasY(sys.bottom, dim.height, DETECT_SCALE)),
        }));

        pageData.push({ pageIdx, imageData, pageSystems, systemBoundaries });
      }

      // Phase 2: Detect staffs via Workers or main thread
      type PageStaffResult = { pageIdx: number; pageSystems: System[]; staffsBySystem: { topPx: number; bottomPx: number }[][] };
      let results: PageStaffResult[];

      if (isWorkerAvailable()) {
        const pool = createWorkerPool();
        try {
          const promises = pageData.map(({ pageIdx, imageData, pageSystems, systemBoundaries }) => {
            const rgbaBuffer = imageData.data.buffer.slice(0);
            return pool.submitTask({
              type: 'DETECT_STAFFS',
              taskId: `staff-${pageIdx}`,
              pageIndex: pageIdx,
              rgbaData: rgbaBuffer,
              width: imageData.width,
              height: imageData.height,
              systemBoundaries,
              partGapHeight: 15,
            }).then((result) => ({
              pageIdx,
              pageSystems,
              staffsBySystem: (result as DetectStaffsResponse).staffsBySystem,
            }));
          });
          results = await Promise.all(promises);
        } finally {
          pool.terminate();
        }
      } else {
        results = pageData.map(({ pageIdx, imageData, pageSystems, systemBoundaries }) => {
          const result = runStaffDetection({
            rgbaData: imageData.data,
            width: imageData.width,
            height: imageData.height,
            systemBoundaries,
            partGapHeight: 15,
          });
          return { pageIdx, pageSystems, staffsBySystem: result.staffsBySystem };
        });
      }

      // Phase 3: Convert pixel boundaries to Staff entities
      const allStaffs: Staff[] = [];
      for (const { pageIdx, pageSystems, staffsBySystem } of results) {
        const dim = pageDimensions[pageIdx];
        if (!dim) continue;
        for (let sysIdx = 0; sysIdx < pageSystems.length; sysIdx++) {
          const sys = pageSystems[sysIdx];
          const boundaries = staffsBySystem[sysIdx] ?? [];
          for (const boundary of boundaries) {
            allStaffs.push({
              id: crypto.randomUUID(),
              pageIndex: pageIdx,
              top: canvasYToPdfY(boundary.topPx, dim.height, DETECT_SCALE),
              bottom: canvasYToPdfY(boundary.bottomPx, dim.height, DETECT_SCALE),
              label: '',
              systemId: sys.id,
            });
          }
        }
      }

      dispatch({ type: 'SET_STAFFS', staffs: allStaffs });
    } finally {
      setDetectingStaffs(false);
    }
  }, [pdfDocument, systems, pageDimensions, dispatch]);

  // Trigger auto-detection when staffs don't match systems
  const needsStaffDetection = systems.length > 0 && !staffsMatchSystems(staffs, systems);
  useEffect(() => {
    if (needsStaffDetection && !detectingStaffs) {
      handleAutoDetectStaffs();
    }
  }, [needsStaffDetection, detectingStaffs, handleAutoDetectStaffs]);

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
      const { staffs: updated, systems: updatedSystems } = addStaffAtPosition(staffs, currentPageIndex, pdfY, dim.height, systems);
      dispatch({ type: 'SET_STAFFS_AND_SYSTEMS', staffs: updated, systems: updatedSystems });
    },
    [staffs, systems, currentPageIndex, pageDimensions, effectiveScale, dispatch],
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

  const handleGoToLabel = useCallback(() => {
    dispatch({ type: 'SET_STEP', step: 'label' });
  }, [dispatch]);

  const handleBack = useCallback(() => {
    dispatch({ type: 'SET_STEP', step: 'systems' });
  }, [dispatch]);

  const staffValidations = useMemo(() => getStaffStepValidations(staffs), [staffs]);

  const currentPageSystems = useMemo(() => {
    const pageSystems = getPageSystems(systems, currentPageIndex);
    const staffsBySystemId = new Map<string, Staff[]>();
    for (const s of staffs) {
      if (s.pageIndex !== currentPageIndex) continue;
      if (!staffsBySystemId.has(s.systemId)) staffsBySystemId.set(s.systemId, []);
      staffsBySystemId.get(s.systemId)!.push(s);
    }
    return pageSystems.map((sys, ordinal) => ({
      ordinal: ordinal,
      systemId: sys.id,
      staffs: (staffsBySystemId.get(sys.id) ?? []).slice().sort((a, b) => b.top - a.top),
    }));
  }, [staffs, systems, currentPageIndex]);

  // Scroll the selected staff row into view
  const selectedRowRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    selectedRowRef.current?.scrollIntoView({ block: 'nearest' });
  }, [selectedStaffId]);

  if (!pdfDocument) return null;

  const currentDimension = pageDimensions[currentPageIndex];

  return (
    <div className={styles.container}>
      <StepToolbar
        onBack={handleBack}
        onNext={handleGoToLabel}
        nextDisabled={staffs.length === 0}
        pageNav={{
          currentPage: currentPageIndex,
          totalPages: pageCount,
          onPrevPage: handlePrevPage,
          onNextPage: handleNextPage,
        }}
      >
        <span className={styles.staffCount}>
          {(() => {
            const counts = currentPageSystems.map((sys) => sys.staffs.length);
            return t('detect.staffCountBySystem', {
              counts: counts.join(' / '),
              systemCount: currentPageSystems.length,
            });
          })()}
        </span>
        <StatusIndicator messages={staffValidations} />
      </StepToolbar>

      <div className={styles.content}>
        <aside className={styles.sidebar}>
          <h3>{t('sidebar.staffStructure')}</h3>
          {currentPageSystems.length === 0 ? (
            <p className={styles.emptyMessage}>{t('sidebar.noStaffsOnPage')}</p>
          ) : (
            currentPageSystems.map((sys) => (
              <div key={sys.systemId} className={styles.systemSection}>
                <div className={styles.systemHeader}>
                  {t('label.systemHeader', { system: sys.ordinal + 1 })}
                </div>
                {sys.staffs.map((staff, idx) => {
                  const isSelected = staff.id === selectedStaffId;
                  return (
                    <div
                      key={staff.id}
                      ref={isSelected ? selectedRowRef : undefined}
                      className={`${styles.staffRow} ${isSelected ? styles.staffRowSelected : ''}`}
                      onClick={() => setSelectedStaffId(staff.id)}
                    >
                      <span className={styles.staffIndex}>{idx + 1}</span>
                      <span className={styles.staffCoords}>
                        {staff.top.toFixed(1)} → {staff.bottom.toFixed(1)}
                      </span>
                      {staff.label && (
                        <span className={styles.staffLabel}>{staff.label}</span>
                      )}
                    </div>
                  );
                })}
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
            {currentDimension && (
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
          </div>
        </div>
      </div>
    </div>
  );
}
