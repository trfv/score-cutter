import { useTranslation } from 'react-i18next';
import { Check, AlertTriangle } from './Icons';
import type { ValidationMessage } from '../core/staffModel';
import styles from './StatusIndicator.module.css';

interface StatusIndicatorProps {
  messages: ValidationMessage[];
}

export function StatusIndicator({ messages }: StatusIndicatorProps) {
  const { t } = useTranslation();

  if (messages.length === 0) return null;

  const primary = messages.find((m) => m.severity === 'warning') ?? messages[0];
  const IconComponent = primary.severity === 'warning' ? AlertTriangle : Check;
  const severityClass = primary.severity === 'warning' ? styles.warning : styles.success;

  return (
    <span className={`${styles.indicator} ${severityClass}`}>
      <IconComponent width={14} height={14} />
      <span className={styles.text}>
        {t(primary.messageKey, primary.messageParams)}
      </span>
    </span>
  );
}
