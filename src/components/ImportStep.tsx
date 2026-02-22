import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useProject, useProjectDispatch } from '../context/projectHooks';
import { loadPdf } from '../core/pdfLoader';
import styles from './ImportStep.module.css';

export function ImportStep() {
  const { t } = useTranslation();
  const project = useProject();
  const dispatch = useProjectDispatch();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const handleFile = useCallback(
    async (file: File) => {
      if (file.type !== 'application/pdf') {
        setError(t('import.invalidFile'));
        return;
      }
      setError('');
      setLoading(true);
      try {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const loaded = await loadPdf(bytes);
        dispatch({
          type: 'LOAD_PDF',
          fileName: file.name,
          pdfBytes: bytes,
          document: loaded.document,
          pageCount: loaded.pageCount,
          pageDimensions: loaded.pageDimensions,
        });
      } catch (e) {
        setError(String(e));
      } finally {
        setLoading(false);
      }
    },
    [dispatch, t],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handleNext = useCallback(() => {
    dispatch({ type: 'SET_STEP', step: 'detect' });
  }, [dispatch]);

  return (
    <div className={styles.container}>
      <div
        className={styles.dropzone}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onClick={handleClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') handleClick();
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          onChange={handleInputChange}
          className={styles.fileInput}
        />
        {loading ? (
          <p>{t('detect.detecting')}</p>
        ) : project.sourceFileName ? (
          <p>
            {t('import.fileSelected', {
              fileName: project.sourceFileName,
              pageCount: project.pageCount,
            })}
          </p>
        ) : (
          <p>{t('import.dropzone')}</p>
        )}
      </div>
      {error && <p className={styles.error}>{error}</p>}
      {project.sourcePdfBytes && (
        <button className={styles.nextButton} onClick={handleNext}>
          {t('common.next')}
        </button>
      )}
    </div>
  );
}
