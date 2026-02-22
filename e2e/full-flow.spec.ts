import { test, expect, uploadPdf, clickNext } from './fixtures/pdf';

test('full wizard flow from import to export', async ({ page, samplePdfPath }) => {
  await page.goto('/');

  // Step 1: Import
  await uploadPdf(page, samplePdfPath);
  await expect(page.getByText('memderssohn.pdf (6 ページ)')).toBeVisible();
  await clickNext(page);

  // Step 2: Systems — detect staves
  await page.getByRole('button', { name: '譜表を自動検出' }).click();
  await expect(page.getByRole('button', { name: '譜表を自動検出' })).toBeEnabled({
    timeout: 45_000,
  });
  await clickNext(page);

  // Step 3: Staffs — skip (no manual edits needed)
  await clickNext(page);

  // Step 4: Label — label two instruments so ZIP button appears
  const inputs = page.locator('input[placeholder="楽器名を入力"]');
  await inputs.nth(0).fill('Soprano');
  await inputs.nth(1).fill('Alto');
  await page.getByRole('button', { name: '全組段に適用' }).click();
  await clickNext(page);

  // Step 5: Preview
  await expect(page.getByText('パートを選択')).toBeVisible();
  await expect(page.getByText('Soprano')).toBeVisible();
  await expect(page.getByText('Alto')).toBeVisible();
  await clickNext(page);

  // Step 6: Export
  await expect(page.getByRole('heading', { name: 'エクスポート' })).toBeVisible();
  await expect(
    page.getByRole('button', { name: '全パートをZIPでダウンロード' }),
  ).toBeVisible();

  // Verify a single-part download works
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'ダウンロード' }).first().click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.pdf$/);
});
