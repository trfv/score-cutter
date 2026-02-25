import { test, expect, uploadPdf, clickNext } from './fixtures/pdf';

test.describe('Mobile Responsive Layout', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('side rail is hidden on mobile', async ({ page }) => {
    const sideRail = page.locator('nav');
    await expect(sideRail).toBeHidden();
  });

  test('header step indicator is visible on mobile', async ({ page }) => {
    const headerSteps = page.locator('[aria-hidden="true"]').first();
    await expect(headerSteps).toBeVisible();
  });

  test('import step fits mobile viewport without horizontal scroll', async ({ page }) => {
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
  });

  test('systems step fits mobile viewport after PDF upload', async ({ page, samplePdfPath }) => {
    await uploadPdf(page, samplePdfPath);

    // Wait for detection to complete
    await expect(page.getByRole('button', { name: '次へ' })).toBeEnabled({
      timeout: 45_000,
    });

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
  });

  test('sidebar is hidden on mobile in systems step', async ({ page, samplePdfPath }) => {
    await uploadPdf(page, samplePdfPath);

    await expect(page.getByRole('button', { name: '次へ' })).toBeEnabled({
      timeout: 45_000,
    });

    // The sidebar element should not be visible
    const sidebar = page.locator('aside, [class*="sidebar"]');
    const count = await sidebar.count();
    for (let i = 0; i < count; i++) {
      await expect(sidebar.nth(i)).toBeHidden();
    }
  });

  test('can navigate through wizard steps on mobile', async ({ page, samplePdfPath }) => {
    await uploadPdf(page, samplePdfPath);

    // Systems step → next
    await expect(page.getByRole('button', { name: '次へ' })).toBeEnabled({
      timeout: 45_000,
    });
    await clickNext(page);

    // Staffs step → next
    await clickNext(page);

    // Label step — verify we arrived by checking the page navigation is present
    // (sidebar with label inputs is hidden on mobile)
    await expect(page.getByText(/ページ 1/)).toBeVisible();
  });
});
