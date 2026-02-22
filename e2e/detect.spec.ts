import { test, expect, uploadPdf, clickNext } from './fixtures/pdf';

test.describe('Detect Step', () => {
  test.beforeEach(async ({ page, samplePdfPath }) => {
    await page.goto('/');
    await uploadPdf(page, samplePdfPath);
    await clickNext(page);
  });

  test('shows detect toolbar', async ({ page }) => {
    await expect(page.getByRole('button', { name: '段を検出' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'セグメント追加' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'セグメント削除' })).toBeVisible();
  });

  test('shows page navigation starting at page 1', async ({ page }) => {
    await expect(page.getByText('ページ 1 / 6')).toBeVisible();
  });

  test('detects segments from PDF', async ({ page }) => {
    await page.getByRole('button', { name: '段を検出' }).click();
    await expect(page.getByText(/\d+ 個のセグメントを検出/)).toBeVisible({
      timeout: 45_000,
    });
  });

  test('Next button is disabled before detection', async ({ page }) => {
    await expect(page.getByRole('button', { name: '次へ' })).toBeDisabled();
  });

  test('Next button enables after detection', async ({ page }) => {
    await page.getByRole('button', { name: '段を検出' }).click();
    await expect(page.getByRole('button', { name: '段を検出' })).toBeEnabled({
      timeout: 45_000,
    });
    await expect(page.getByRole('button', { name: '次へ' })).toBeEnabled();
  });

  test('page navigation works', async ({ page }) => {
    await page.getByRole('button', { name: '>' }).click();
    await expect(page.getByText('ページ 2 / 6')).toBeVisible();
    await page.getByRole('button', { name: '<' }).click();
    await expect(page.getByText('ページ 1 / 6')).toBeVisible();
  });
});
