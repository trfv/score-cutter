import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight } from './Icons';
import styles from './StepToolbar.module.css';

interface PageNavProps {
  currentPage: number;
  totalPages: number;
  onPrevPage: () => void;
  onNextPage: () => void;
}

interface StepToolbarProps {
  onBack?: () => void;
  onNext?: () => void;
  nextDisabled?: boolean;
  pageNav?: PageNavProps;
  children?: ReactNode;
}

export function StepToolbar({ onBack, onNext, nextDisabled, pageNav, children }: StepToolbarProps) {
  const { t } = useTranslation();

  return (
    <div className={styles.toolbar}>
      <div className={styles.left}>
        {onBack && (
          <button className={styles.backButton} onClick={onBack}>
            <ChevronLeft width={14} height={14} />
            {t('common.back')}
          </button>
        )}
      </div>

      <div className={styles.center}>
        {pageNav && (
          <div className={styles.pageNav}>
            <button onClick={pageNav.onPrevPage} disabled={pageNav.currentPage === 0}>
              <ChevronLeft width={14} height={14} />
            </button>
            <span>
              {t('detect.page', {
                current: pageNav.currentPage + 1,
                total: pageNav.totalPages,
              })}
            </span>
            <button onClick={pageNav.onNextPage} disabled={pageNav.currentPage >= pageNav.totalPages - 1}>
              <ChevronRight width={14} height={14} />
            </button>
          </div>
        )}
        {children}
      </div>

      <div className={styles.right}>
        {onNext && (
          <button className={styles.nextButton} onClick={onNext} disabled={nextDisabled}>
            {t('common.next')}
            <ChevronRight width={14} height={14} />
          </button>
        )}
      </div>
    </div>
  );
}
