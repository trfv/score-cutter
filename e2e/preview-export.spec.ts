import {
  test,
  expect,
  completeImportStep,
  completeDetectStep,
  completeLabelStep,
  clickNext,
} from './fixtures/pdf';

test.describe('Preview Step', () => {
  test.beforeEach(async ({ page, samplePdfPath }) => {
    await page.goto('/');
    await completeImportStep(page, samplePdfPath);
    await completeDetectStep(page);
    await completeLabelStep(page);
  });

  test('shows part list with labeled parts', async ({ page }) => {
    await expect(page.getByText('パートを選択')).toBeVisible();
    await expect(page.getByText('Soprano')).toBeVisible();
  });

  test('shows segment details for selected part', async ({ page }) => {
    await page.getByText('Soprano').first().click();
    await expect(page.getByText(/ページ \d+ \/ 6/).first()).toBeVisible();
  });

  test('Next button navigates to Export step', async ({ page }) => {
    await clickNext(page);
    await expect(page.getByRole('heading', { name: 'エクスポート' })).toBeVisible();
  });
});

test.describe('Export Step', () => {
  test.beforeEach(async ({ page, samplePdfPath }) => {
    await page.goto('/');
    await completeImportStep(page, samplePdfPath);
    await completeDetectStep(page);
    await completeLabelStep(page);
    await clickNext(page);
  });

  test('shows export heading and part cards', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'エクスポート' })).toBeVisible();
    await expect(page.getByText('Soprano')).toBeVisible();
  });

  test('shows download button for each part', async ({ page }) => {
    await expect(
      page.getByRole('button', { name: 'ダウンロード' }).first(),
    ).toBeVisible();
  });

  test('download button triggers file download', async ({ page }) => {
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'ダウンロード' }).first().click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('Soprano');
    expect(download.suggestedFilename()).toMatch(/\.pdf$/);
  });
});
