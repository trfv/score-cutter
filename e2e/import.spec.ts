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

  test('uploads PDF and navigates to Systems step', async ({ page, samplePdfPath }) => {
    await uploadPdf(page, samplePdfPath);
    // Should auto-navigate to Systems step
    await expect(page.getByText(/ページ 1/)).toBeVisible();
  });
});
