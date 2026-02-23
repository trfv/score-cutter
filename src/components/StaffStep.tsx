import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useProject, useProjectDispatch } from '../context/projectHooks';
import { PageCanvas } from './PageCanvas';
import { SeparatorOverlay } from './SeparatorOverlay';
import { StatusIndicator } from './StatusIndicator';
import { canvasYToPdfY, getScale } from '../core/coordinateMapper';
import { applySeparatorDrag, splitStaffAtPosition, mergeSeparator, computeSeparators, addStaffAtPosition } from '../core/separatorModel';
import { getStaffStepValidations } from '../core/staffModel';
import type { Staff } from '../core/staffModel';
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
    const bySystem = new Map<number, Staff[]>();
    for (const s of staffs) {
      if (s.pageIndex !== currentPageIndex) continue;
      if (!bySystem.has(s.systemIndex)) bySystem.set(s.systemIndex, []);
      bySystem.get(s.systemIndex)!.push(s);
    }
    return [...bySystem.entries()]
      .sort(([a], [b]) => a - b)
      .map(([systemIndex, stfs]) => ({
        systemIndex,
        staffs: stfs.slice().sort((a, b) => b.top - a.top),
      }));
  }, [staffs, currentPageIndex]);

  // Scroll the selected staff row into view
  const selectedRowRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    selectedRowRef.current?.scrollIntoView({ block: 'nearest' });
  }, [selectedStaffId]);

  if (!pdfDocument) return null;

  const currentDimension = pageDimensions[currentPageIndex];
  const pageStaffs = staffs.filter((s) => s.pageIndex === currentPageIndex);

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
            const systemMap = new Map<number, number>();
            for (const s of pageStaffs) {
              systemMap.set(s.systemIndex, (systemMap.get(s.systemIndex) ?? 0) + 1);
            }
            const sortedCounts = [...systemMap.entries()]
              .sort(([a], [b]) => a - b)
              .map(([, count]) => count);
            return t('detect.staffCountBySystem', {
              counts: sortedCounts.join(' / '),
              systemCount: systemMap.size,
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
              <div key={sys.systemIndex} className={styles.systemSection}>
                <div className={styles.systemHeader}>
                  {t('label.systemHeader', { system: sys.systemIndex + 1 })}
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
