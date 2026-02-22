export function getScale(dpi: number): number {
  return dpi / 72;
}

export function canvasYToPdfY(
  canvasY: number,
  pdfPageHeight: number,
  scale: number,
): number {
  return pdfPageHeight - canvasY / scale;
}

export function pdfYToCanvasY(
  pdfY: number,
  pdfPageHeight: number,
  scale: number,
): number {
  return (pdfPageHeight - pdfY) * scale;
}
