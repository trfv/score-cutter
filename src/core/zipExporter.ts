import JSZip from 'jszip';
import { assemblePart } from './partAssembler';
import type { Part } from './segmentModel';
import type { AssemblyOptions } from './partAssembler';

export interface ZipProgress {
  currentPartIndex: number;
  totalParts: number;
  currentPartLabel: string;
}

export async function zipParts(
  sourcePdfBytes: Uint8Array,
  parts: Part[],
  options: AssemblyOptions,
  onProgress?: (progress: ZipProgress) => void,
): Promise<Uint8Array> {
  const zip = new JSZip();

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    onProgress?.({
      currentPartIndex: i,
      totalParts: parts.length,
      currentPartLabel: part.label,
    });

    const pdfBytes = await assemblePart(sourcePdfBytes, part.segments, options);
    const fileName = `${part.label.replace(/\s+/g, '_')}.pdf`;
    zip.file(fileName, pdfBytes);
  }

  return zip.generateAsync({ type: 'uint8array' });
}
