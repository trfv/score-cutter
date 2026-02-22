import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useProject, useProjectDispatch } from '../context/projectHooks';
import { PageCanvas } from './PageCanvas';
import { SeparatorOverlay } from './SeparatorOverlay';
import { getScale } from '../core/coordinateMapper';
import { applySeparatorDrag } from '../core/separatorModel';
import { ChevronLeft, ChevronRight } from './Icons';
import styles from './LabelStep.module.css';

const DISPLAY_DPI = 150;
const DISPLAY_SCALE = getScale(DISPLAY_DPI);

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

  const handleApplyToAll = useCallback(() => {
    // Use page 0, system 0 as the template
    const templateStaffs = staffs
      .filter((s) => s.pageIndex === 0 && s.systemIndex === 0)
      .sort((a, b) => b.top - a.top);

    if (templateStaffs.length === 0) return;

    const updatedStaffs = staffs.map((staff) => {
      if (staff.pageIndex === 0 && staff.systemIndex === 0) return staff;

      // Find staffs in the same system on the same page
      const sameSystemStaffs = staffs
        .filter((s) => s.pageIndex === staff.pageIndex && s.systemIndex === staff.systemIndex)
        .sort((a, b) => b.top - a.top);

      const idx = sameSystemStaffs.findIndex((s) => s.id === staff.id);
      if (idx >= 0 && idx < templateStaffs.length) {
        return { ...staff, label: templateStaffs[idx].label };
      }
      return staff;
    });

    dispatch({ type: 'SET_STAFFS', staffs: updatedStaffs });
  }, [staffs, dispatch]);

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

  if (!pdfDocument) return null;

  const currentDimension = pageDimensions[currentPageIndex];
  const pageStaffs = staffs.filter((s) => s.pageIndex === currentPageIndex);
  const hasLabels = staffs.some((s) => s.label !== '');

  return (
    <div className={styles.container}>
      <div className={styles.toolbar}>
        <button onClick={handleApplyToAll}>{t('label.applyToAll')}</button>
      </div>

      <div className={styles.content}>
        <div className={styles.sidebar}>
          <h3>{t('steps.label')}</h3>
          {pageStaffs.sort((a, b) => b.top - a.top).map((staff, idx) => (
            <div
              key={staff.id}
              className={styles.staffRow}
            >
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
        </div>

        <div className={styles.canvasArea}>
          <div className={styles.pageNav}>
            <button onClick={handlePrevPage} disabled={currentPageIndex === 0}>
              <ChevronLeft width={16} height={16} />
            </button>
            <span>
              {t('detect.page', {
                current: currentPageIndex + 1,
                total: pageCount,
              })}
            </span>
            <button onClick={handleNextPage} disabled={currentPageIndex >= pageCount - 1}>
              <ChevronRight width={16} height={16} />
            </button>
          </div>
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
              />
            )}
          </div>
        </div>
      </div>

      <div className={styles.navigation}>
        <button onClick={handleBack}>{t('common.back')}</button>
        <button onClick={handleNext} disabled={!hasLabels}>
          {t('common.next')}
        </button>
      </div>
    </div>
  );
}
