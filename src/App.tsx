import { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ProjectProvider } from './context/ProjectContext';
import { useProject } from './context/projectHooks';
import { useUndoRedoKeyboard } from './hooks/useUndoRedoKeyboard';
import { ImportStep } from './components/ImportStep';
import { SystemStep } from './components/SystemStep';
import { StaffStep } from './components/StaffStep';
import { LabelStep } from './components/LabelStep';
import { ExportStep } from './components/ExportStep';
import { Sun, Moon, Check, Globe } from './components/Icons';
import type { WizardStep } from './context/ProjectContext';
import styles from './App.module.css';

const STEPS: WizardStep[] = ['import', 'systems', 'staffs', 'label', 'export'];

type Theme = 'dark' | 'light';

function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    return (document.documentElement.getAttribute('data-theme') as Theme) || 'dark';
  });

  const toggle = useCallback(() => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      return next;
    });
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return { theme, toggle } as const;
}

function StepIndicator() {
  const { t } = useTranslation();
  const { step } = useProject();
  const currentIdx = STEPS.indexOf(step);

  return (
    <nav className={styles.sideRail} aria-label="Wizard steps">
      {STEPS.map((s, i) => {
        const isActive = s === step;
        const isCompleted = currentIdx > i;
        const cls = [
          styles.step,
          isActive ? styles.active : '',
          isCompleted ? styles.completed : '',
        ]
          .filter(Boolean)
          .join(' ');

        return (
          <div key={s} className={cls}>
            <span className={styles.stepCircle}>
              {isCompleted ? <Check width={14} height={14} /> : i + 1}
            </span>
            <span className={styles.stepLabel}>{t(`steps.${s}`)}</span>
          </div>
        );
      })}
    </nav>
  );
}

function LanguageSwitcher() {
  const { i18n, t } = useTranslation();

  return (
    <select
      className={styles.langSwitcher}
      value={i18n.language}
      onChange={(e) => i18n.changeLanguage(e.target.value)}
      aria-label={t('common.language')}
    >
      <option value="ja">日本語</option>
      <option value="en">English</option>
    </select>
  );
}

function WizardContent() {
  const { step } = useProject();

  switch (step) {
    case 'import':
      return <ImportStep />;
    case 'systems':
      return <SystemStep />;
    case 'staffs':
      return <StaffStep />;
    case 'label':
      return <LabelStep />;
    case 'export':
      return <ExportStep />;
    default:
      return null;
  }
}

function AppContent() {
  const { t } = useTranslation();
  const { theme, toggle } = useTheme();
  useUndoRedoKeyboard();

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <h1 className={styles.logo}>Score Cutter</h1>
        <div className={styles.headerSpacer} />
        <div className={styles.headerActions}>
          <button
            className={styles.iconButton}
            onClick={toggle}
            aria-label={t('common.themeToggle')}
            title={theme === 'dark' ? t('common.lightMode') : t('common.darkMode')}
          >
            {theme === 'dark' ? <Sun width={18} height={18} /> : <Moon width={18} height={18} />}
          </button>
          <Globe width={16} height={16} style={{ color: 'var(--text-muted)' }} />
          <LanguageSwitcher />
        </div>
      </header>
      <StepIndicator />
      <main className={styles.main}>
        <WizardContent />
      </main>
    </div>
  );
}

function App() {
  return (
    <ProjectProvider>
      <AppContent />
    </ProjectProvider>
  );
}

export default App;
