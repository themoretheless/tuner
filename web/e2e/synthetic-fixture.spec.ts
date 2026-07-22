import { expect, test } from '@playwright/test';

test('detects E2 through the synthetic fixture without microphone access', async ({ page }) => {
  await page.goto('/?fixture=E2');

  await page.getByTestId('mic-toggle').click();

  await expect(page.getByTestId('session-status')).toContainText(/LISTENING|СЛУШАЕТ/);
  await expect(page.getByTestId('detected-note')).toHaveText('E2');
});

test('keeps metadata, diagnostics and ear-training state coherent', async ({ page }) => {
  await page.goto('/?fixture=E2');

  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  await page.getByRole('button', { name: 'RU / EN' }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');

  await expect(page.locator('canvas')).toHaveCount(0);
  const correct = page.locator('[data-ear-action="correct"]');
  await expect(correct).toBeDisabled();
  await page.locator('[data-ear-action="next"]').click();
  await expect(correct).toBeEnabled();
  await correct.click();
  await expect(correct).toBeDisabled();
});
