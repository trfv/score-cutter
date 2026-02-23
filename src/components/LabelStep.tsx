import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useProject, useProjectDispatch } from '../context/projectHooks';
import { PageCanvas } from './PageCanvas';
import { SeparatorOverlay } from './SeparatorOverlay';
import { getScale } from '../core/coordinateMapper';
import { applySeparatorDrag } from '../core/separatorModel';
import { applySystemLabelsToAll, getLabelStepValidations } from '../core/staffModel';
import type { Staff } from '../core/staffModel';
import { StepToolbar } from './StepToolbar';
import { StatusIndicator } from './StatusIndicator';
import styles from './LabelStep.module.css';

const DISPLAY_DPI = 150;
const DISPLAY_SCALE = getScale(DISPLAY_DPI);

interface SystemGroup {
  systemIndex: number;
  staffs: Staff[];
}

export function LabelStep() {
  const { t } = useTranslation();
  const project = useProject();
  const dispatch = useProjectDispatch();
  const [bitmapWidth, setBitmapWidth] = useState(0);
  const [canvasWidth, setCanvasWidth] = useState(0);
  const [canvasHeight, setCanvasHeight] = useState(0);

  const { pdfDocument, currentPageIndex, pageCount, pageDimensions, staffs } = project;

  const displayRatio = bitmapWidth > 0 ? canvasWidth / bitmapWidth : 1;
  const effectiveScale = DISPLAY_SCALE * displayRatio;

  const currentPageSystems: SystemGroup[] = useMemo(() => {
    const bySystem = new Map<number, Staff[]>();
    for (const staff of staffs) {
      if (staff.pageIndex !== currentPageIndex) continue;
      if (!bySystem.has(staff.systemIndex)) bySystem.set(staff.systemIndex, []);
      bySystem.get(staff.systemIndex)!.push(staff);
    }

    const result: SystemGroup[] = [];
    const sortedIndices = [...bySystem.keys()].sort((a, b) => a - b);
    for (const si of sortedIndices) {
      const stfs = bySystem.get(si)!.slice().sort((a, b) => b.top - a.top);
      result.push({ systemIndex: si, staffs: stfs });
    }
    return result;
  }, [staffs, currentPageIndex]);

  const handleCanvasReady = useCallback((canvas: HTMLCanvasElement) => {
    setBitmapWidth(canvas.width);
    setCanvasWidth(canvas.clientWidth);
    setCanvasHeight(canvas.clientHeight);
  }, []);

  const handleLabelChange = useCallback(
    (staffId: string, label: string) => {
      const staff = staffs.find((s) => s.id === staffId);
      if (!staff) return;
      dispatch({ type: 'UPDATE_STAFF', staff: { ...staff, label } });
    },
    [staffs, dispatch],
  );

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

  const handleApplyToAll = useCallback(
    (pageIndex: number, systemIndex: number) => {
      const updated = applySystemLabelsToAll(staffs, pageIndex, systemIndex);
      dispatch({ type: 'SET_STAFFS', staffs: updated });
    },
    [staffs, dispatch],
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

  const handleBack = useCallback(() => {
    dispatch({ type: 'SET_STEP', step: 'staffs' });
  }, [dispatch]);

  const handleNext = useCallback(() => {
    dispatch({ type: 'SET_STEP', step: 'export' });
  }, [dispatch]);

  const labelValidations = useMemo(() => getLabelStepValidations(staffs), [staffs]);

  if (!pdfDocument) return null;

  const currentDimension = pageDimensions[currentPageIndex];
  const hasLabels = staffs.some((s) => s.label !== '');

  return (
    <div className={styles.container}>
      <StepToolbar
        onBack={handleBack}
        onNext={handleNext}
        nextDisabled={!hasLabels}
        pageNav={{
          currentPage: currentPageIndex,
          totalPages: pageCount,
          onPrevPage: handlePrevPage,
          onNextPage: handleNextPage,
        }}
      >
        <StatusIndicator messages={labelValidations} />
      </StepToolbar>

      <div className={styles.content}>
        <aside className={styles.sidebar}>
          <h3>{t('steps.label')}</h3>
          {currentPageSystems.map((system) => (
            <div key={system.systemIndex} className={styles.systemSection}>
              <div className={styles.systemHeader}>
                {t('label.systemHeader', { system: system.systemIndex + 1 })}
              </div>

              {system.staffs.map((staff, idx) => (
                <div key={staff.id} className={styles.staffRow}>
                  <span className={styles.staffIndex}>{idx + 1}</span>
                  <input
                    type="text"
                    value={staff.label}
                    onChange={(e) => handleLabelChange(staff.id, e.target.value)}
                    placeholder={t('label.placeholder')}
                    className={styles.labelInput}
                  />
                </div>
              ))}

              <button
                className={styles.applyButton}
                onClick={() => handleApplyToAll(currentPageIndex, system.systemIndex)}
              >
                {t('label.applyToAll')}
              </button>
            </div>
          ))}
        </aside>

        <div className={styles.canvasArea}>
          <div className={styles.canvasContainer}>
            <PageCanvas
              document={pdfDocument}
              pageIndex={currentPageIndex}
              scale={DISPLAY_SCALE}
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
                onSeparatorDrag={handleSeparatorDrag}
                dragOnly
                showLabels
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
