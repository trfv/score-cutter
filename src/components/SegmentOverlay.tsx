import { useCallback } from 'react';
import type { Segment } from '../core/segmentModel';
import { pdfYToCanvasY } from '../core/coordinateMapper';
import styles from './SegmentOverlay.module.css';

const LABEL_COLORS = [
  'rgba(74, 144, 217, 0.2)',
  'rgba(217, 83, 79, 0.2)',
  'rgba(92, 184, 92, 0.2)',
  'rgba(240, 173, 78, 0.2)',
  'rgba(153, 102, 204, 0.2)',
  'rgba(255, 127, 80, 0.2)',
];

interface SegmentOverlayProps {
  segments: Segment[];
  pageIndex: number;
  pdfPageHeight: number;
  scale: number;
  canvasWidth: number;
  selectedSegmentId: string | null;
  onSelect: (segmentId: string) => void;
  onBoundaryDrag: (segmentId: string, edge: 'top' | 'bottom', newCanvasY: number) => void;
}

export function SegmentOverlay({
  segments,
  pageIndex,
  pdfPageHeight,
  scale,
  canvasWidth,
  selectedSegmentId,
  onSelect,
  onBoundaryDrag,
}: SegmentOverlayProps) {
  const pageSegments = segments.filter((s) => s.pageIndex === pageIndex);
  const uniqueLabels = [...new Set(segments.map((s) => s.label).filter(Boolean))];

  const getColor = (label: string) => {
    const idx = uniqueLabels.indexOf(label);
    return LABEL_COLORS[idx % LABEL_COLORS.length] || LABEL_COLORS[0];
  };

  // Compute system separator positions
  const sortedByPosition = [...pageSegments].sort(
    (a, b) => pdfYToCanvasY(a.top, pdfPageHeight, scale) - pdfYToCanvasY(b.top, pdfPageHeight, scale),
  );
  const systemSeparators: number[] = [];
  for (let i = 1; i < sortedByPosition.length; i++) {
    if (sortedByPosition[i].systemIndex !== sortedByPosition[i - 1].systemIndex) {
      const prevBottom = pdfYToCanvasY(sortedByPosition[i - 1].bottom, pdfPageHeight, scale);
      const nextTop = pdfYToCanvasY(sortedByPosition[i].top, pdfPageHeight, scale);
      systemSeparators.push((prevBottom + nextTop) / 2);
    }
  }

  return (
    <div className={styles.overlay} style={{ width: canvasWidth }}>
      {systemSeparators.map((y, i) => (
        <div
          key={`sys-sep-${i}`}
          className={styles.systemSeparator}
          style={{ top: y, width: canvasWidth }}
        />
      ))}
      {pageSegments.map((seg) => {
        const topPx = pdfYToCanvasY(seg.top, pdfPageHeight, scale);
        const bottomPx = pdfYToCanvasY(seg.bottom, pdfPageHeight, scale);
        const height = bottomPx - topPx;
        const isSelected = seg.id === selectedSegmentId;

        return (
          <div
            key={seg.id}
            className={`${styles.segment} ${isSelected ? styles.selected : ''}`}
            style={{
              top: topPx,
              height,
              width: canvasWidth,
              backgroundColor: seg.label ? getColor(seg.label) : 'rgba(200, 200, 200, 0.2)',
            }}
            onClick={() => onSelect(seg.id)}
          >
            {seg.label && <span className={styles.label}>{seg.label}</span>}
            <DragHandle
              segmentId={seg.id}
              edge="top"
              onDrag={onBoundaryDrag}
            />
            <DragHandle
              segmentId={seg.id}
              edge="bottom"
              onDrag={onBoundaryDrag}
            />
          </div>
        );
      })}
    </div>
  );
}

interface DragHandleProps {
  segmentId: string;
  edge: 'top' | 'bottom';
  onDrag: (segmentId: string, edge: 'top' | 'bottom', newCanvasY: number) => void;
}

function DragHandle({ segmentId, edge, onDrag }: DragHandleProps) {
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation();
      e.preventDefault();
      const target = e.currentTarget as HTMLElement;
      target.setPointerCapture(e.pointerId);

      const overlayEl = target.closest(`.${styles.overlay}`) as HTMLElement;
      if (!overlayEl) return;

      const handlePointerMove = (moveEvent: PointerEvent) => {
        const rect = overlayEl.getBoundingClientRect();
        const y = moveEvent.clientY - rect.top;
        onDrag(segmentId, edge, y);
      };

      const handlePointerUp = () => {
        target.removeEventListener('pointermove', handlePointerMove);
        target.removeEventListener('pointerup', handlePointerUp);
      };

      target.addEventListener('pointermove', handlePointerMove);
      target.addEventListener('pointerup', handlePointerUp);
    },
    [segmentId, edge, onDrag],
  );

  return (
    <div
      className={`${styles.handle} ${styles[edge]}`}
      onPointerDown={handlePointerDown}
    />
  );
}
