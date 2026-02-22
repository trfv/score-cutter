import {
  test,
  expect,
  completeImportStep,
  completeDetectStep,
  completeLabelStep,
} from './fixtures/pdf';

test.describe('Export Step', () => {
  test.beforeEach(async ({ page, samplePdfPath }) => {
    await page.goto('/');
    await completeImportStep(page, samplePdfPath);
    await completeDetectStep(page);
    await completeLabelStep(page);
    // completeLabelStep clicks Next, which now goes directly to Export
  });

  test('shows part list with labeled parts', async ({ page }) => {
    await expect(page.getByText('パートを選択')).toBeVisible();
    await expect(page.getByText('Soprano')).toBeVisible();
  });

  test('shows download button for each part', async ({ page }) => {
    await expect(
      page.getByRole('button', { name: 'ダウンロード' }).first(),
    ).toBeVisible();
  });

  test('renders PDF preview for selected part', async ({ page }) => {
    await expect(page.locator('canvas').first()).toBeVisible({ timeout: 30_000 });
  });

  test('download button triggers file download', async ({ page }) => {
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'ダウンロード' }).first().click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('Soprano');
    expect(download.suggestedFilename()).toMatch(/\.pdf$/);
  });
});
