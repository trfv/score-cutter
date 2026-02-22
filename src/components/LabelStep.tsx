import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useProject, useProjectDispatch, useUndoRedo } from '../context/projectHooks';
import { PageCanvas } from './PageCanvas';
import { SegmentOverlay } from './SegmentOverlay';
import { getScale } from '../core/coordinateMapper';
import styles from './LabelStep.module.css';

const DISPLAY_DPI = 150;
const DISPLAY_SCALE = getScale(DISPLAY_DPI);

const COMMON_INSTRUMENTS = [
  'Violin I', 'Violin II', 'Viola', 'Cello', 'Contrabass',
  'Flute', 'Oboe', 'Clarinet', 'Bassoon',
  'Horn', 'Trumpet', 'Trombone', 'Tuba',
  'Timpani', 'Percussion',
  'Soprano', 'Alto', 'Tenor', 'Bass',
  'Piano', 'Organ', 'Harp',
  'Basso continuo',
];

export function LabelStep() {
  const { t } = useTranslation();
  const project = useProject();
  const dispatch = useProjectDispatch();
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);
  const [canvasWidth, setCanvasWidth] = useState(0);
  const [filterText, setFilterText] = useState('');

  const { canUndo: undoAvailable, canRedo: redoAvailable } = useUndoRedo();
  const { pdfDocument, currentPageIndex, pageCount, pageDimensions, segments } = project;

  const filteredInstruments = useMemo(() => {
    if (!filterText) return COMMON_INSTRUMENTS;
    const lower = filterText.toLowerCase();
    return COMMON_INSTRUMENTS.filter((i) => i.toLowerCase().includes(lower));
  }, [filterText]);

  const handleCanvasReady = useCallback((canvas: HTMLCanvasElement) => {
    setCanvasWidth(canvas.width);
  }, []);

  const handleLabelChange = useCallback(
    (segmentId: string, label: string) => {
      const seg = segments.find((s) => s.id === segmentId);
      if (!seg) return;
      dispatch({ type: 'UPDATE_SEGMENT', segment: { ...seg, label } });
    },
    [segments, dispatch],
  );

  const handleApplyToAll = useCallback(() => {
    // Use page 0, system 0 as the template
    const templateSegments = segments
      .filter((s) => s.pageIndex === 0 && s.systemIndex === 0)
      .sort((a, b) => b.top - a.top);

    if (templateSegments.length === 0) return;

    const updatedSegments = segments.map((seg) => {
      if (seg.pageIndex === 0 && seg.systemIndex === 0) return seg;

      // Find segments in the same system on the same page
      const sameSystemSegs = segments
        .filter((s) => s.pageIndex === seg.pageIndex && s.systemIndex === seg.systemIndex)
        .sort((a, b) => b.top - a.top);

      const idx = sameSystemSegs.findIndex((s) => s.id === seg.id);
      if (idx >= 0 && idx < templateSegments.length) {
        return { ...seg, label: templateSegments[idx].label };
      }
      return seg;
    });

    dispatch({ type: 'SET_SEGMENTS', segments: updatedSegments });
  }, [segments, dispatch]);

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
    dispatch({ type: 'SET_STEP', step: 'detect' });
  }, [dispatch]);

  const handleNext = useCallback(() => {
    dispatch({ type: 'SET_STEP', step: 'preview' });
  }, [dispatch]);

  const handleBoundaryDrag = useCallback(() => {}, []);

  if (!pdfDocument) return null;

  const currentDimension = pageDimensions[currentPageIndex];
  const pageSegments = segments.filter((s) => s.pageIndex === currentPageIndex);
  const hasLabels = segments.some((s) => s.label !== '');

  return (
    <div className={styles.container}>
      <div className={styles.toolbar}>
        <button onClick={handleApplyToAll}>{t('label.applyToAll')}</button>
        <button onClick={() => dispatch({ type: 'UNDO' })} disabled={!undoAvailable}>
          {t('common.undo')}
        </button>
        <button onClick={() => dispatch({ type: 'REDO' })} disabled={!redoAvailable}>
          {t('common.redo')}
        </button>
      </div>

      <div className={styles.content}>
        <div className={styles.sidebar}>
          <h3>{t('steps.label')}</h3>
          {pageSegments.sort((a, b) => b.top - a.top).map((seg, idx) => (
            <div
              key={seg.id}
              className={`${styles.segmentRow} ${
                selectedSegmentId === seg.id ? styles.selectedRow : ''
              }`}
              onClick={() => setSelectedSegmentId(seg.id)}
            >
              <span className={styles.segmentIndex}>{idx + 1}</span>
              <input
                type="text"
                value={seg.label}
                onChange={(e) => handleLabelChange(seg.id, e.target.value)}
                onFocus={() => {
                  setSelectedSegmentId(seg.id);
                  setFilterText(seg.label);
                }}
                placeholder={t('label.placeholder')}
                className={styles.labelInput}
                list="instrument-list"
              />
            </div>
          ))}
          <datalist id="instrument-list">
            {filteredInstruments.map((inst) => (
              <option key={inst} value={inst} />
            ))}
          </datalist>
        </div>

        <div className={styles.canvasArea}>
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
              scale={DISPLAY_SCALE}
              onCanvasReady={handleCanvasReady}
            />
            {currentDimension && (
              <SegmentOverlay
                segments={segments}
                pageIndex={currentPageIndex}
                pdfPageHeight={currentDimension.height}
                scale={DISPLAY_SCALE}
                canvasWidth={canvasWidth}
                selectedSegmentId={selectedSegmentId}
                onSelect={setSelectedSegmentId}
                onBoundaryDrag={handleBoundaryDrag}
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
