import { test, expect, uploadPdf, clickNext } from './fixtures/pdf';

test.describe('Systems Step', () => {
  test.beforeEach(async ({ page, samplePdfPath }) => {
    await page.goto('/');
    await uploadPdf(page, samplePdfPath);
  });

  test('shows page navigation', async ({ page }) => {
    await expect(page.getByText('ページ 1 / 6')).toBeVisible();
  });

  test('auto-detects staffs and enables Next button', async ({ page }) => {
    // Detection runs automatically on mount
    await expect(page.getByRole('button', { name: '次へ' })).toBeEnabled({
      timeout: 45_000,
    });
  });

  test('page navigation works', async ({ page }) => {
    await page.getByRole('button', { name: '>' }).click();
    await expect(page.getByText('ページ 2 / 6')).toBeVisible();
    await page.getByRole('button', { name: '<' }).click();
    await expect(page.getByText('ページ 1 / 6')).toBeVisible();
  });
});

test.describe('Staffs Step — Keyboard', () => {
  test.beforeEach(async ({ page, samplePdfPath }) => {
    await page.goto('/');
    await uploadPdf(page, samplePdfPath);
    // Wait for detection to complete
    await expect(page.getByRole('button', { name: '次へ' })).toBeEnabled({
      timeout: 45_000,
    });
    // Navigate from Systems → Staffs
    await clickNext(page);
  });

  test('Tab focuses a separator', async ({ page }) => {
    // There are toolbar buttons and page nav buttons before separators in tab order.
    // Press Tab repeatedly until we reach a separator element.
    const maxTabs = 30;
    let found = false;
    for (let i = 0; i < maxTabs; i++) {
      await page.keyboard.press('Tab');
      const focused = page.locator(':focus');
      const role = await focused.getAttribute('role');
      if (role === 'separator') {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
    // Verify the focused element is indeed a separator
    await expect(page.locator(':focus')).toHaveRole('separator');
  });
});
