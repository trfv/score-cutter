import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useProject, useProjectDispatch } from '../context/projectHooks';
import { derivePartsFromStaffs } from '../core/staffModel';
import styles from './PreviewStep.module.css';

export function PreviewStep() {
  const { t } = useTranslation();
  const project = useProject();
  const dispatch = useProjectDispatch();
  const [selectedPartLabel, setSelectedPartLabel] = useState<string | null>(null);

  const parts = useMemo(
    () => derivePartsFromStaffs(project.staffs),
    [project.staffs],
  );

  const selectedPart = parts.find((p) => p.label === selectedPartLabel) ?? parts[0] ?? null;

  const handleBack = useCallback(() => {
    dispatch({ type: 'SET_STEP', step: 'label' });
  }, [dispatch]);

  const handleNext = useCallback(() => {
    dispatch({ type: 'SET_STEP', step: 'export' });
  }, [dispatch]);

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <div className={styles.sidebar}>
          <h3>{t('preview.selectPart')}</h3>
          <ul className={styles.partList}>
            {parts.map((part) => (
              <li
                key={part.label}
                className={`${styles.partItem} ${
                  selectedPart?.label === part.label ? styles.active : ''
                }`}
                onClick={() => setSelectedPartLabel(part.label)}
              >
                <span className={styles.partLabel}>{part.label}</span>
                <span className={styles.partCount}>
                  {part.staffs.length} staffs
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className={styles.preview}>
          {selectedPart ? (
            <div className={styles.staffList}>
              {selectedPart.staffs.map((staff, idx) => (
                <div key={staff.id} className={styles.staffPreview}>
                  <span className={styles.staffInfo}>
                    {t('detect.page', {
                      current: staff.pageIndex + 1,
                      total: project.pageCount,
                    })}
                    {' — '}
                    Staff {idx + 1}
                  </span>
                  <span className={styles.staffCoords}>
                    Y: {Math.round(staff.bottom)} - {Math.round(staff.top)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className={styles.empty}>{t('preview.noStaffs')}</p>
          )}
        </div>
      </div>

      <div className={styles.navigation}>
        <button onClick={handleBack}>{t('common.back')}</button>
        <button onClick={handleNext} disabled={parts.length === 0}>
          {t('common.next')}
        </button>
      </div>
    </div>
  );
}
