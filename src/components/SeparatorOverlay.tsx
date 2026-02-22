import { useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { Staff } from '../core/staffModel';
import { computeSystemGroups } from '../core/separatorModel';
import type { Separator } from '../core/separatorModel';
import styles from './SeparatorOverlay.module.css';

const SEPARATOR_EXTENSION = 40;

interface SeparatorOverlayProps {
  staffs: Staff[];
  pageIndex: number;
  pdfPageHeight: number;
  scale: number;
  canvasWidth: number;
  canvasHeight: number;
  onSeparatorDrag: (separatorIndex: number, newCanvasY: number) => void;
  dragOnly?: boolean;
  selectedStaffId?: string | null;
  onSelectStaff?: (staffId: string | null) => void;
  selectedSeparatorIndex?: number | null;
  onSelectSeparator?: (index: number | null) => void;
  onSplitAtPosition?: (staffId: string, canvasY: number) => void;
  onMergeSeparator?: (separatorIndex: number) => void;
  onDeleteStaff?: (staffId: string) => void;
  onAddStaff?: (canvasY: number) => void;
}

export function SeparatorOverlay({
  staffs,
  pageIndex,
  pdfPageHeight,
  scale,
  canvasWidth,
  canvasHeight,
  onSeparatorDrag,
  dragOnly,
  selectedStaffId,
  onSelectStaff,
  selectedSeparatorIndex,
  onSelectSeparator,
  onSplitAtPosition,
  onMergeSeparator,
  onDeleteStaff,
  onAddStaff,
}: SeparatorOverlayProps) {
  const pageStaffs = staffs.filter((s) => s.pageIndex === pageIndex);
  const groups = computeSystemGroups(pageStaffs, pdfPageHeight, scale);
  const separators = groups.flatMap(g => g.separators);
  const regions = groups.flatMap(g => g.regions);

  const handleRegionClick = useCallback(
    (staffId: string) => {
      onSelectStaff?.(staffId);
      onSelectSeparator?.(null);
    },
    [onSelectStaff, onSelectSeparator],
  );

  const handleRegionDoubleClick = useCallback(
    (staffId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (!onSplitAtPosition) return;
      const overlayEl = (e.target as HTMLElement).closest(`.${styles.overlay}`);
      if (!overlayEl) return;
      const rect = overlayEl.getBoundingClientRect();
      const canvasY = e.clientY - rect.top;
      onSplitAtPosition(staffId, canvasY);
    },
    [onSplitAtPosition],
  );

  const handleOverlayDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      if (!onAddStaff) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const canvasY = e.clientY - rect.top;
      onAddStaff(canvasY);
    },
    [onAddStaff],
  );

  const handleSeparatorSelect = useCallback(
    (index: number) => {
      onSelectSeparator?.(index);
      onSelectStaff?.(null);
    },
    [onSelectSeparator, onSelectStaff],
  );

  return (
    <div
      className={styles.overlay}
      style={{ width: canvasWidth, height: canvasHeight, pointerEvents: dragOnly ? 'none' : 'auto' }}
      onDoubleClick={dragOnly ? undefined : handleOverlayDoubleClick}
    >
      {/* System background rectangles (read-only) */}
      {groups.map((group, gi) => (
        <div
          key={`sys-${group.systemIndex}`}
          className={`${styles.systemBackground} ${gi % 2 === 0 ? styles.systemBackgroundEven : styles.systemBackgroundOdd}`}
          style={{
            top: group.topCanvasY,
            height: group.bottomCanvasY - group.topCanvasY,
            width: canvasWidth,
          }}
        />
      ))}
      {!dragOnly && regions.map((region) => {
        const isSelected = region.staffId === selectedStaffId;
        const height = region.bottomCanvasY - region.topCanvasY;
        return (
          <div
            key={region.staffId}
            className={`${styles.region} ${isSelected ? styles.selected : ''}`}
            style={{
              top: region.topCanvasY,
              height,
              width: canvasWidth,
            }}
            onClick={() => handleRegionClick(region.staffId)}
            onDoubleClick={(e) => handleRegionDoubleClick(region.staffId, e)}
          >
            {region.label && <span className={styles.label}>{region.label}</span>}
          </div>
        );
      })}
      {separators.map((sep, i) => (
        <SeparatorLine
          key={i}
          separator={sep}
          index={i}
          canvasWidth={canvasWidth}
          isSelected={!dragOnly && selectedSeparatorIndex === i}
          onSelect={handleSeparatorSelect}
          onDrag={onSeparatorDrag}
          onMerge={onMergeSeparator}
          onDeleteStaff={onDeleteStaff}
          dragOnly={dragOnly}
        />
      ))}
    </div>
  );
}

interface SeparatorLineProps {
  separator: Separator;
  index: number;
  canvasWidth: number;
  isSelected: boolean;
  onSelect: (index: number) => void;
  onDrag: (separatorIndex: number, newCanvasY: number) => void;
  onMerge?: (separatorIndex: number) => void;
  onDeleteStaff?: (staffId: string) => void;
  dragOnly?: boolean;
}

function SeparatorLine({ separator, index, canvasWidth, isSelected, onSelect, onDrag, onMerge, onDeleteStaff, dragOnly }: SeparatorLineProps) {
  const { t } = useTranslation();
  const clickTimerRef = useRef<number | null>(null);

  const kindClass = separator.kind === 'edge' ? styles.separatorEdge : styles.separatorPart;
  const isMergeable = separator.kind === 'part';

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

        if (!dragOnly && !dragged && isMergeable) {
          // Single click = select separator (delay to allow double-click)
          clickTimerRef.current = window.setTimeout(() => {
            clickTimerRef.current = null;
            onSelect(index);
          }, 250);
        }
      };

      target.addEventListener('pointermove', handlePointerMove);
      target.addEventListener('pointerup', handlePointerUp);
    },
    [index, onDrag, onSelect, isMergeable, dragOnly],
  );

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      if (dragOnly) return;
      e.stopPropagation();
      if (clickTimerRef.current !== null) {
        clearTimeout(clickTimerRef.current);
        clickTimerRef.current = null;
      }
      if (isMergeable && onMerge) {
        onMerge(index);
      }
    },
    [index, onMerge, isMergeable, dragOnly],
  );

  const handleDeleteClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      if (isMergeable && onMerge) {
        onMerge(index);
      } else {
        // Edge separator: delete the adjacent staff
        const staffId = separator.staffBelowId ?? separator.staffAboveId;
        if (staffId && onDeleteStaff) onDeleteStaff(staffId);
      }
    },
    [index, onMerge, onDeleteStaff, isMergeable, separator],
  );

  const handleDeletePointerDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (dragOnly) return;
      const step = e.shiftKey ? 10 : 1;
      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          onDrag(index, separator.canvasY - step);
          break;
        case 'ArrowDown':
          e.preventDefault();
          onDrag(index, separator.canvasY + step);
          break;
        case 'Delete':
        case 'Backspace':
          e.preventDefault();
          if (isMergeable && onMerge) {
            onMerge(index);
          } else {
            const staffId = separator.staffBelowId ?? separator.staffAboveId;
            if (staffId && onDeleteStaff) onDeleteStaff(staffId);
          }
          break;
        case 'Escape':
          (e.currentTarget as HTMLElement).blur();
          break;
      }
    },
    [index, separator.canvasY, separator.staffBelowId, separator.staffAboveId, onDrag, onMerge, onDeleteStaff, isMergeable, dragOnly],
  );

  const handleFocus = useCallback(() => {
    if (!dragOnly) {
      onSelect(index);
    }
  }, [index, onSelect, dragOnly]);

  // Determine the aria-label based on separator kind
  const deleteLabel = isMergeable
    ? t('detect.deleteSeparator')
    : t('detect.deleteStaff');

  return (
    <div
      className={`${styles.separator} ${kindClass} ${isSelected ? styles.selectedSeparator : ''}`}
      style={{
        top: separator.canvasY,
        left: -SEPARATOR_EXTENSION,
        width: canvasWidth + SEPARATOR_EXTENSION * 2,
      }}
      tabIndex={dragOnly ? -1 : 0}
      role="separator"
      aria-label={deleteLabel}
      aria-orientation="horizontal"
      onPointerDown={handlePointerDown}
      onDoubleClick={dragOnly ? undefined : handleDoubleClick}
      onKeyDown={handleKeyDown}
      onFocus={handleFocus}
    >
      <div className={styles.hitArea} />
      <div className={styles.line} />
      {!dragOnly && (
        <button
          className={`${styles.deleteButton} ${styles.deleteButtonLeft}`}
          onClick={handleDeleteClick}
          onPointerDown={handleDeletePointerDown}
          aria-label={deleteLabel}
          type="button"
        >
          <span className={styles.deleteIcon} />
        </button>
      )}
      <div className={styles.gripHandle} aria-hidden="true">
        <span className={styles.gripIcon} />
      </div>
    </div>
  );
}
