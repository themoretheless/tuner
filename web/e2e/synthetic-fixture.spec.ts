import { expect, test } from '@playwright/test';

test('detects E2 through the synthetic fixture without microphone access', async ({ page }) => {
  await page.goto('/?fixture=E2');

  await page.getByTestId('mic-toggle').click();

  await expect(page.getByTestId('session-status')).toContainText(/LISTENING|СЛУШАЕТ/);
  await expect(page.getByTestId('detected-note')).toHaveText('E2');
  await expect(page.getByTestId('session-status')).toHaveAttribute('data-detector-backend', 'wasm');
});
