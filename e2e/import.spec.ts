import { test, expect, uploadPdf } from './fixtures/pdf';

test.describe('Import Step', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('shows dropzone text on initial load', async ({ page }) => {
    await expect(
      page.getByText('PDF ファイルをドラッグ＆ドロップ、またはクリックして選択'),
    ).toBeVisible();
  });

  test('Next button is hidden before file upload', async ({ page }) => {
    await expect(page.getByRole('button', { name: '次へ' })).not.toBeVisible();
  });

  test('uploads PDF and shows file info', async ({ page, samplePdfPath }) => {
    await uploadPdf(page, samplePdfPath);
    await expect(page.getByText('memderssohn.pdf (6 ページ)')).toBeVisible();
  });

  test('Next button appears after upload', async ({ page, samplePdfPath }) => {
    await uploadPdf(page, samplePdfPath);
    await expect(page.getByRole('button', { name: '次へ' })).toBeVisible();
    await expect(page.getByRole('button', { name: '次へ' })).toBeEnabled();
  });
});
