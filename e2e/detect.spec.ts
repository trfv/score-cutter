import { test, expect, uploadPdf, clickNext } from './fixtures/pdf';

test.describe('Detect Step', () => {
  test.beforeEach(async ({ page, samplePdfPath }) => {
    await page.goto('/');
    await uploadPdf(page, samplePdfPath);
    await clickNext(page);
  });

  test('shows detect button and page navigation', async ({ page }) => {
    await expect(page.getByRole('button', { name: '譜表を自動検出' })).toBeVisible();
    await expect(page.getByText('ページ 1 / 6')).toBeVisible();
  });

  test('Next button is disabled before detection', async ({ page }) => {
    await expect(page.getByRole('button', { name: '次へ' })).toBeDisabled();
  });

  test('detects staffs from PDF', async ({ page }) => {
    await page.getByRole('button', { name: '譜表を自動検出' }).click();
    await expect(page.getByRole('button', { name: '譜表を自動検出' })).toBeEnabled({
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
