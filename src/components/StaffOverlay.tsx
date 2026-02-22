import { useCallback } from 'react';
import type { Staff } from '../core/staffModel';
import { pdfYToCanvasY } from '../core/coordinateMapper';
import styles from './StaffOverlay.module.css';

const LABEL_COLORS = [
  'rgba(74, 144, 217, 0.2)',
  'rgba(217, 83, 79, 0.2)',
  'rgba(92, 184, 92, 0.2)',
  'rgba(240, 173, 78, 0.2)',
  'rgba(153, 102, 204, 0.2)',
  'rgba(255, 127, 80, 0.2)',
];

interface StaffOverlayProps {
  staffs: Staff[];
  pageIndex: number;
  pdfPageHeight: number;
  scale: number;
  canvasWidth: number;
  onBoundaryDrag?: (staffId: string, edge: 'top' | 'bottom', newCanvasY: number) => void;
}

export function StaffOverlay({
  staffs,
  pageIndex,
  pdfPageHeight,
  scale,
  canvasWidth,
  onBoundaryDrag,
}: StaffOverlayProps) {
  const pageStaffs = staffs.filter((s) => s.pageIndex === pageIndex);
  const uniqueLabels = [...new Set(staffs.map((s) => s.label).filter(Boolean))];

  const getColor = (label: string) => {
    const idx = uniqueLabels.indexOf(label);
    return LABEL_COLORS[idx % LABEL_COLORS.length] || LABEL_COLORS[0];
  };

  // Sort by visual position (top to bottom on screen)
  const sorted = [...pageStaffs].sort(
    (a, b) => pdfYToCanvasY(a.top, pdfPageHeight, scale) - pdfYToCanvasY(b.top, pdfPageHeight, scale),
  );

  return (
    <div className={styles.overlay} style={{ width: canvasWidth }}>
      {sorted.map((staff, i) => {
        const topPx = pdfYToCanvasY(staff.top, pdfPageHeight, scale);
        const bottomPx = pdfYToCanvasY(staff.bottom, pdfPageHeight, scale);

        // Extend colored region to midpoint between adjacent staffs (same system only)
        const prevSameSystem = i > 0 && sorted[i - 1].systemIndex === staff.systemIndex;
        const nextSameSystem = i < sorted.length - 1 && sorted[i + 1].systemIndex === staff.systemIndex;
        const extTop = prevSameSystem
          ? (pdfYToCanvasY(sorted[i - 1].bottom, pdfPageHeight, scale) + topPx) / 2
          : topPx;
        const extBottom = nextSameSystem
          ? (bottomPx + pdfYToCanvasY(sorted[i + 1].top, pdfPageHeight, scale)) / 2
          : bottomPx;

        return (
          <div
            key={staff.id}
            className={styles.staff}
            style={{
              top: extTop,
              height: extBottom - extTop,
              width: canvasWidth,
              backgroundColor: staff.label ? getColor(staff.label) : 'rgba(200, 200, 200, 0.2)',
            }}
          >
            {staff.label && <span className={styles.label}>{staff.label}</span>}
            {onBoundaryDrag && (
              <>
                <DragHandle
                  staffId={staff.id}
                  edge="top"
                  onDrag={onBoundaryDrag}
                />
                <DragHandle
                  staffId={staff.id}
                  edge="bottom"
                  onDrag={onBoundaryDrag}
                />
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

interface DragHandleProps {
  staffId: string;
  edge: 'top' | 'bottom';
  onDrag: (staffId: string, edge: 'top' | 'bottom', newCanvasY: number) => void;
}

function DragHandle({ staffId, edge, onDrag }: DragHandleProps) {
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
        onDrag(staffId, edge, y);
      };

      const handlePointerUp = () => {
        target.removeEventListener('pointermove', handlePointerMove);
        target.removeEventListener('pointerup', handlePointerUp);
      };

      target.addEventListener('pointermove', handlePointerMove);
      target.addEventListener('pointerup', handlePointerUp);
    },
    [staffId, edge, onDrag],
  );

  return (
    <div
      className={`${styles.handle} ${styles[edge]}`}
      onPointerDown={handlePointerDown}
    />
  );
}
