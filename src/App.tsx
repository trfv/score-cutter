import { useTranslation } from 'react-i18next';
import { ProjectProvider } from './context/ProjectContext';
import { useProject } from './context/projectHooks';
import { useUndoRedoKeyboard } from './hooks/useUndoRedoKeyboard';
import { ImportStep } from './components/ImportStep';
import { StaffStep } from './components/StaffStep';
import { LabelStep } from './components/LabelStep';
import { PreviewStep } from './components/PreviewStep';
import { ExportStep } from './components/ExportStep';
import type { WizardStep } from './context/ProjectContext';
import styles from './App.module.css';

const STEPS: WizardStep[] = ['import', 'systems', 'staffs', 'label', 'preview', 'export'];

function StepIndicator() {
  const { t } = useTranslation();
  const { step } = useProject();

  return (
    <nav className={styles.stepIndicator}>
      {STEPS.map((s, i) => (
        <div
          key={s}
          className={`${styles.step} ${s === step ? styles.active : ''} ${
            STEPS.indexOf(step) > i ? styles.completed : ''
          }`}
        >
          <span className={styles.stepNumber}>{i + 1}</span>
          <span className={styles.stepLabel}>{t(`steps.${s}`)}</span>
        </div>
      ))}
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
      return <StaffStep />; // Temporary: SystemStep will replace this
    case 'staffs':
      return <StaffStep />;
    case 'label':
      return <LabelStep />;
    case 'preview':
      return <PreviewStep />;
    case 'export':
      return <ExportStep />;
    default:
      return null;
  }
}

function AppContent() {
  const { t } = useTranslation();
  useUndoRedoKeyboard();

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <h1 className={styles.title}>{t('app.title')}</h1>
        <p className={styles.subtitle}>{t('app.subtitle')}</p>
        <LanguageSwitcher />
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
