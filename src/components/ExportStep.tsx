import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { useProject, useProjectDispatch } from '../context/projectHooks';
import { derivePartsFromStaffs } from '../core/staffModel';
import { assemblePart, defaultAssemblyOptions } from '../core/partAssembler';
import { loadPdf } from '../core/pdfLoader';
import { zipParts } from '../core/zipExporter';
import { getScale } from '../core/coordinateMapper';
import { PageCanvas } from './PageCanvas';
import type { Part } from '../core/staffModel';
import type { ZipProgress } from '../core/zipExporter';
import { Download, Archive } from './Icons';
import { StepToolbar } from './StepToolbar';
import styles from './ExportStep.module.css';

const DISPLAY_DPI = 150;
const DISPLAY_SCALE = getScale(DISPLAY_DPI);

export function ExportStep() {
  const { t } = useTranslation();
  const project = useProject();
  const dispatch = useProjectDispatch();

  const [selectedPartLabel, setSelectedPartLabel] = useState<string | null>(null);
  const [assembling, setAssembling] = useState(false);
  const [assemblyError, setAssemblyError] = useState<string | null>(null);
  const [generating, setGenerating] = useState<string | null>(null);
  const [zipProgress, setZipProgress] = useState<ZipProgress | null>(null);
  const [activeDoc, setActiveDoc] = useState<PDFDocumentProxy | null>(null);
  const [activePageCount, setActivePageCount] = useState(0);

  const pdfBytesCache = useRef(new Map<string, Uint8Array>());
  const docCache = useRef(new Map<string, PDFDocumentProxy>());

  const parts = useMemo(
    () => derivePartsFromStaffs(project.staffs),
    [project.staffs],
  );

  const selectedPart = parts.find((p) => p.label === selectedPartLabel) ?? parts[0] ?? null;
  const effectiveLabel = selectedPart?.label ?? null;

  useEffect(() => {
    if (!effectiveLabel || !project.sourcePdfBytes) return;

    const part = parts.find((p) => p.label === effectiveLabel);
    if (!part) return;

    let cancelled = false;

    async function assembleAndLoad() {
      setAssemblyError(null);

      let pdfBytes = pdfBytesCache.current.get(effectiveLabel!);
      if (!pdfBytes) {
        setAssembling(true);
        try {
          pdfBytes = await assemblePart(
            project.sourcePdfBytes!,
            part!.staffs,
            defaultAssemblyOptions,
          );
          if (cancelled) return;
          pdfBytesCache.current.set(effectiveLabel!, pdfBytes);
        } catch {
          if (!cancelled) {
            setAssemblyError(effectiveLabel);
            setAssembling(false);
          }
          return;
        }
        if (!cancelled) setAssembling(false);
      }

      let doc = docCache.current.get(effectiveLabel!);
      if (!doc) {
        const loaded = await loadPdf(pdfBytes);
        if (cancelled) {
          loaded.document.destroy();
          return;
        }
        doc = loaded.document;
        docCache.current.set(effectiveLabel!, doc);
      }

      if (!cancelled) {
        setActiveDoc(doc);
        setActivePageCount(doc.numPages);
      }
    }

    assembleAndLoad();

    return () => {
      cancelled = true;
    };
  }, [effectiveLabel, parts, project.sourcePdfBytes]);

  useEffect(() => {
    const cache = docCache.current;
    return () => {
      for (const doc of cache.values()) {
        doc.destroy();
      }
      cache.clear();
    };
  }, []);

  const handleSelectPart = useCallback((label: string) => {
    setSelectedPartLabel(label);
    setActiveDoc(null);
    setActivePageCount(0);
  }, []);

  const handleDownload = useCallback(
    async (part: Part) => {
      if (!project.sourcePdfBytes) return;
      setGenerating(part.label);
      try {
        let pdfBytes = pdfBytesCache.current.get(part.label);
        if (!pdfBytes) {
          pdfBytes = await assemblePart(
            project.sourcePdfBytes,
            part.staffs,
            defaultAssemblyOptions,
          );
          pdfBytesCache.current.set(part.label, pdfBytes);
        }
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
    dispatch({ type: 'SET_STEP', step: 'label' });
  }, [dispatch]);

  return (
    <div className={styles.container}>
      <StepToolbar onBack={handleBack} />

      <div className={styles.content}>
          <div className={styles.sidebar}>
            <h3>{t('export.selectPart')}</h3>
          <ul className={styles.partList}>
            {parts.map((part) => (
              <li
                key={part.label}
                className={`${styles.partItem} ${
                  effectiveLabel === part.label ? styles.active : ''
                }`}
                onClick={() => handleSelectPart(part.label)}
              >
                <div className={styles.partInfo}>
                  <span className={styles.partLabel}>{part.label}</span>
                  <span className={styles.partMeta}>
                    {t('export.staffCount', { count: part.staffs.length })}
                  </span>
                </div>
                <button
                  className={styles.downloadButton}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDownload(part);
                  }}
                  disabled={generating !== null || zipProgress !== null}
                >
                  <Download width={14} height={14} />
                  {generating === part.label
                    ? t('export.generating')
                    : t('export.download')}
                </button>
              </li>
            ))}
          </ul>

          {parts.length > 1 && (
            <>
              <button
                className={styles.downloadAllButton}
                onClick={handleDownloadAll}
                disabled={generating !== null || zipProgress !== null}
              >
                <Archive width={16} height={16} />
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
                    style={{
                      width: `${((zipProgress.currentPartIndex + 1) / zipProgress.totalParts) * 100}%`,
                    }}
                  />
                </div>
              )}
            </>
          )}
        </div>

        <div className={styles.previewPane}>
          {assembling ? (
            <div className={styles.loading}>{t('export.assembling')}</div>
          ) : assemblyError ? (
            <div className={styles.error}>{t('export.assemblyError')}</div>
          ) : activeDoc ? (
            <div className={styles.pageList}>
              {Array.from({ length: activePageCount }, (_, i) => (
                <div key={`${effectiveLabel}-${i}`} className={styles.canvasContainer}>
                  <PageCanvas
                    document={activeDoc}
                    pageIndex={i}
                    scale={DISPLAY_SCALE}
                  />
                </div>
              ))}
            </div>
          ) : parts.length === 0 ? (
            <p className={styles.empty}>{t('export.noStaffs')}</p>
          ) : null}
          </div>
        </div>
    </div>
  );
}
