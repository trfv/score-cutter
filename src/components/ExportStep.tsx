import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useProject, useProjectDispatch } from '../context/projectHooks';
import { derivePartsFromSegments } from '../core/segmentModel';
import { assemblePart, defaultAssemblyOptions } from '../core/partAssembler';
import { zipParts } from '../core/zipExporter';
import type { ZipProgress } from '../core/zipExporter';
import type { Part } from '../core/segmentModel';
import styles from './ExportStep.module.css';

export function ExportStep() {
  const { t } = useTranslation();
  const project = useProject();
  const dispatch = useProjectDispatch();
  const [generating, setGenerating] = useState<string | null>(null);
  const [zipProgress, setZipProgress] = useState<ZipProgress | null>(null);

  const parts = useMemo(
    () => derivePartsFromSegments(project.segments),
    [project.segments],
  );

  const handleDownload = useCallback(
    async (part: Part) => {
      if (!project.sourcePdfBytes) return;
      setGenerating(part.label);
      try {
        const pdfBytes = await assemblePart(
          project.sourcePdfBytes,
          part.segments,
          defaultAssemblyOptions,
        );
        const blob = new Blob([pdfBytes as unknown as ArrayBuffer], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${part.label.replace(/\s+/g, '_')}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      } finally {
        setGenerating(null);
      }
    },
    [project.sourcePdfBytes],
  );

  const handleDownloadAll = useCallback(async () => {
    if (!project.sourcePdfBytes) return;
    setZipProgress({ currentPartIndex: 0, totalParts: parts.length, currentPartLabel: '' });
    try {
      const zipBytes = await zipParts(
        project.sourcePdfBytes,
        parts,
        defaultAssemblyOptions,
        setZipProgress,
      );
      const blob = new Blob([zipBytes as unknown as ArrayBuffer], { type: 'application/zip' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const baseName = project.sourceFileName.replace(/\.pdf$/i, '');
      a.download = `${baseName}_parts.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setZipProgress(null);
    }
  }, [project.sourcePdfBytes, project.sourceFileName, parts]);

  const handleBack = useCallback(() => {
    dispatch({ type: 'SET_STEP', step: 'preview' });
  }, [dispatch]);

  return (
    <div className={styles.container}>
      <h2>{t('steps.export')}</h2>

      <div className={styles.partGrid}>
        {parts.map((part) => (
          <div key={part.label} className={styles.partCard}>
            <div className={styles.partInfo}>
              <span className={styles.partLabel}>{part.label}</span>
              <span className={styles.partMeta}>
                {part.segments.length} segments
              </span>
            </div>
            <button
              className={styles.downloadButton}
              onClick={() => handleDownload(part)}
              disabled={generating !== null || zipProgress !== null}
            >
              {generating === part.label
                ? t('export.generating')
                : t('export.download')}
            </button>
          </div>
        ))}
      </div>

      {parts.length > 1 && (
        <>
          <button
            className={styles.downloadAllButton}
            onClick={handleDownloadAll}
            disabled={generating !== null || zipProgress !== null}
          >
            {zipProgress !== null
              ? t('export.zipping', {
                  current: zipProgress.currentPartIndex + 1,
                  total: zipProgress.totalParts,
                  label: zipProgress.currentPartLabel,
                })
              : t('export.downloadAllZip')}
          </button>
          {zipProgress !== null && (
            <div className={styles.progressBar}>
              <div
                className={styles.progressFill}
                style={{ width: `${((zipProgress.currentPartIndex + 1) / zipProgress.totalParts) * 100}%` }}
              />
            </div>
          )}
        </>
      )}

      <div className={styles.navigation}>
        <button onClick={handleBack}>{t('common.back')}</button>
      </div>
    </div>
  );
}
