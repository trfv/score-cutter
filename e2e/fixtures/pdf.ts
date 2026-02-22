import { test as base, expect, type Page } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE_PDF = path.join(__dirname, '..', '..', 'samples', 'memderssohn.pdf');

export const test = base.extend<{ samplePdfPath: string }>({
  samplePdfPath: SAMPLE_PDF,
});

export async function uploadPdf(page: Page, pdfPath: string) {
  const fileInput = page.locator('input[type="file"][accept="application/pdf"]');
  await fileInput.setInputFiles(pdfPath);
  // Auto-navigates to Systems step after load
  await expect(page.getByText(/ページ 1/)).toBeVisible({ timeout: 10_000 });
}

export async function clickNext(page: Page) {
  await page.getByRole('button', { name: '次へ' }).click();
}

export async function completeImportStep(page: Page, pdfPath: string) {
  await uploadPdf(page, pdfPath);
}

async function completeSystemsStep(page: Page) {
  // Detection runs automatically on mount; wait for it to finish
  await expect(page.getByRole('button', { name: '次へ' })).toBeEnabled({
    timeout: 45_000,
  });
  await clickNext(page); // Systems → Staffs
}

async function completeStaffsStep(page: Page) {
  await clickNext(page); // Staffs → Label
}

export async function completeDetectStep(page: Page) {
  await completeSystemsStep(page);
  await completeStaffsStep(page);
}

export async function completeLabelStep(page: Page) {
  const inputs = page.locator('input[placeholder="楽器名を入力"]');
  await inputs.first().fill('Soprano');
  await page.getByRole('button', { name: '全組段に適用' }).click();
  await clickNext(page);
}

export { expect };
