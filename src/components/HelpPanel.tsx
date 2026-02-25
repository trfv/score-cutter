import { useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { WizardStep } from '../context/ProjectContext';
import styles from './HelpPanel.module.css';

interface HelpPanelProps {
  currentStep: WizardStep;
  onClose: () => void;
}

const STEP_KEYS: Record<WizardStep, string> = {
  import: 'import',
  systems: 'systems',
  staffs: 'staffs',
  label: 'label',
  export: 'export',
};

export function HelpPanel({ currentStep, onClose }: HelpPanelProps) {
  const { t } = useTranslation();
  const stepKey = STEP_KEYS[currentStep];
  const tips = t(`help.${stepKey}.tips`, { returnObjects: true }) as string[];
  const keyboard = t(`help.${stepKey}.keyboard`, { defaultValue: '' });

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className={styles.overlay} onClick={onClose} role="dialog" aria-modal="true" aria-label={t('help.title')}>
      <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>{t(`help.${stepKey}.title`)}</h2>
          <button className={styles.closeButton} onClick={onClose} aria-label={t('help.close')}>
            &times;
          </button>
        </div>
        <div className={styles.body}>
          <ul className={styles.tipList}>
            {tips.map((tip, i) => (
              <li key={i} className={styles.tipItem}>
                <span className={styles.tipBullet} />
                <span>{tip}</span>
              </li>
            ))}
          </ul>
          {keyboard && (
            <div className={styles.keyboardSection}>
              <div className={styles.keyboardLabel}>{keyboard}</div>
            </div>
          )}
          <div className={styles.shortcuts}>
            <h3 className={styles.shortcutsTitle}>{t('help.shortcuts.title')}</h3>
            <div className={styles.shortcutRow}>{t('help.shortcuts.undo')}</div>
            <div className={styles.shortcutRow}>{t('help.shortcuts.redo')}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
