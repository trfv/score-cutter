import { useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { Staff } from '../core/staffModel';
import { computeSystemGroups } from '../core/separatorModel';
import type { SystemGroup } from '../core/separatorModel';
import styles from './SystemOverlay.module.css';

const SYSTEM_COLORS = [styles.systemRectEven, styles.systemRectOdd];

interface SystemOverlayProps {
  staffs: Staff[];
  pageIndex: number;
  pdfPageHeight: number;
  scale: number;
  canvasWidth: number;
  canvasHeight: number;
  selectedSystemSepIndex: number | null;
  onSelectSystemSep: (index: number | null) => void;
  onSystemSepDrag: (systemSepIndex: number, newCanvasY: number) => void;
  onSplitSystem: (canvasY: number) => void;
  onMergeSystem: (upperSystemIndex: number) => void;
}

export function SystemOverlay({
  staffs,
  pageIndex,
  pdfPageHeight,
  scale,
  canvasWidth,
  canvasHeight,
  selectedSystemSepIndex,
  onSelectSystemSep,
  onSystemSepDrag,
  onSplitSystem,
  onMergeSystem,
}: SystemOverlayProps) {
  const pageStaffs = staffs.filter((s) => s.pageIndex === pageIndex);
  const groups = computeSystemGroups(pageStaffs, pdfPageHeight, scale);

  // Build system separator positions (between adjacent system groups)
  const systemSeps: Array<{ canvasY: number; upperGroup: SystemGroup; lowerGroup: SystemGroup }> = [];
  for (let i = 0; i < groups.length - 1; i++) {
    const upper = groups[i];
    const lower = groups[i + 1];
    systemSeps.push({
      canvasY: (upper.bottomCanvasY + lower.topCanvasY) / 2,
      upperGroup: upper,
      lowerGroup: lower,
    });
  }

  const handleOverlayDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const canvasY = e.clientY - rect.top;
      onSplitSystem(canvasY);
    },
    [onSplitSystem],
  );

  return (
    <div
      className={styles.overlay}
      style={{ width: canvasWidth, height: canvasHeight }}
      onDoubleClick={handleOverlayDoubleClick}
    >
      {/* System rectangles */}
      {groups.map((group, gi) => (
        <div
          key={group.systemIndex}
          className={`${styles.systemRect} ${SYSTEM_COLORS[gi % 2]}`}
          style={{
            top: group.topCanvasY,
            height: group.bottomCanvasY - group.topCanvasY,
            width: canvasWidth,
          }}
        >
          {/* Staff preview rectangles within system */}
          {group.regions.map((region) => (
            <div
              key={region.staffId}
              className={styles.staffPreview}
              style={{
                top: region.topCanvasY - group.topCanvasY,
                height: region.bottomCanvasY - region.topCanvasY,
                width: canvasWidth,
              }}
            />
          ))}
        </div>
      ))}

      {/* System separators between groups */}
      {systemSeps.map((sep, i) => (
        <SystemSeparatorLine
          key={i}
          index={i}
          canvasY={sep.canvasY}
          canvasWidth={canvasWidth}
          isSelected={selectedSystemSepIndex === i}
          onSelect={onSelectSystemSep}
          onDrag={onSystemSepDrag}
          onMerge={() => onMergeSystem(sep.upperGroup.systemIndex)}
        />
      ))}
    </div>
  );
}

interface SystemSeparatorLineProps {
  index: number;
  canvasY: number;
  canvasWidth: number;
  isSelected: boolean;
  onSelect: (index: number | null) => void;
  onDrag: (index: number, newCanvasY: number) => void;
  onMerge: () => void;
}

function SystemSeparatorLine({
  index,
  canvasY,
  canvasWidth,
  isSelected,
  onSelect,
  onDrag,
  onMerge,
}: SystemSeparatorLineProps) {
  const { t } = useTranslation();
  const clickTimerRef = useRef<number | null>(null);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const step = e.shiftKey ? 10 : 1;
      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          onDrag(index, canvasY - step);
          break;
        case 'ArrowDown':
          e.preventDefault();
          onDrag(index, canvasY + step);
          break;
        case 'Delete':
        case 'Backspace':
          e.preventDefault();
          onMerge();
          break;
        case 'Escape':
          (e.currentTarget as HTMLElement).blur();
          break;
      }
    },
    [index, canvasY, onDrag, onMerge],
  );

  const handleFocus = useCallback(() => {
    onSelect(index);
  }, [index, onSelect]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation();
      e.preventDefault();
      const target = e.currentTarget as HTMLElement;
      target.setPointerCapture(e.pointerId);

      const overlayEl = target.closest(`.${styles.overlay}`) as HTMLElement;
      if (!overlayEl) return;

      let dragged = false;

      const handlePointerMove = (moveEvent: PointerEvent) => {
        dragged = true;
        const rect = overlayEl.getBoundingClientRect();
        const y = moveEvent.clientY - rect.top;
        onDrag(index, y);
      };

      const handlePointerUp = () => {
        target.removeEventListener('pointermove', handlePointerMove);
        target.removeEventListener('pointerup', handlePointerUp);

        if (!dragged) {
          clickTimerRef.current = window.setTimeout(() => {
            clickTimerRef.current = null;
            onSelect(index);
          }, 250);
        }
      };

      target.addEventListener('pointermove', handlePointerMove);
      target.addEventListener('pointerup', handlePointerUp);
    },
    [index, onDrag, onSelect],
  );

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (clickTimerRef.current !== null) {
        clearTimeout(clickTimerRef.current);
        clickTimerRef.current = null;
      }
      onMerge();
    },
    [onMerge],
  );

  const handleDeleteClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      onMerge();
    },
    [onMerge],
  );

  const handleDeletePointerDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
  }, []);

  const ariaLabel = t('detect.deleteSystemSeparator');

  return (
    <div
      className={`${styles.systemSeparator} ${isSelected ? styles.selected : ''}`}
      style={{
        top: canvasY,
        width: canvasWidth,
      }}
      tabIndex={0}
      role="separator"
      aria-label={ariaLabel}
      aria-orientation="horizontal"
      onPointerDown={handlePointerDown}
      onDoubleClick={handleDoubleClick}
      onKeyDown={handleKeyDown}
      onFocus={handleFocus}
    >
      <div className={styles.systemSeparatorHitArea} />
      <div className={styles.systemSeparatorLine} />
      <button
        className={`${styles.deleteButton} ${styles.deleteButtonLeft}`}
        onClick={handleDeleteClick}
        onPointerDown={handleDeletePointerDown}
        type="button"
      >
        <span className={styles.deleteIcon} />
      </button>
      <div className={styles.gripHandle} aria-hidden="true">
        <span className={styles.gripIcon} />
      </div>
    </div>
  );
}
