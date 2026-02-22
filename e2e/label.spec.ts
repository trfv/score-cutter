import { test, expect, completeImportStep, completeDetectStep } from './fixtures/pdf';

test.describe('Label Step', () => {
  test.beforeEach(async ({ page, samplePdfPath }) => {
    await page.goto('/');
    await completeImportStep(page, samplePdfPath);
    await completeDetectStep(page);
  });

  test('shows label inputs for page staffs', async ({ page }) => {
    const inputs = page.locator('input[placeholder="楽器名を入力"]');
    await expect(inputs.first()).toBeVisible();
    const count = await inputs.count();
    expect(count).toBeGreaterThan(0);
  });

  test('Next button is disabled when no labels exist', async ({ page }) => {
    await expect(page.getByRole('button', { name: '次へ' })).toBeDisabled();
  });

  test('typing a label enables the Next button', async ({ page }) => {
    const firstInput = page.locator('input[placeholder="楽器名を入力"]').first();
    await firstInput.fill('Soprano');
    await expect(page.getByRole('button', { name: '次へ' })).toBeEnabled();
  });

  test('Apply to all pages propagates labels', async ({ page }) => {
    const inputs = page.locator('input[placeholder="楽器名を入力"]');
    await inputs.first().fill('Soprano');

    await page.getByRole('button', { name: '全ページに適用' }).click();

    // Navigate to page 2
    await page.getByRole('button', { name: '>' }).click();
    await expect(page.getByText('ページ 2 / 6')).toBeVisible();

    const page2FirstInput = page.locator('input[placeholder="楽器名を入力"]').first();
    await expect(page2FirstInput).toHaveValue('Soprano');
  });
});
