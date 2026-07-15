import { expect, test } from '@playwright/test';

test('detects E2 through the synthetic fixture without microphone access', async ({ page }) => {
  await page.goto('/?fixture=E2');

  await page.getByTestId('mic-toggle').click();

  await expect(page.getByTestId('session-status')).toContainText(/LISTENING|СЛУШАЕТ/);
  await expect(page.getByTestId('detected-note')).toHaveText('E2');
  await expect(page.getByTestId('detected-frequency')).toHaveText('82.4');
  await expect(page.getByTestId('session-status')).toHaveAttribute('data-detector-backend', 'wasm');
});

test('streams the canonical detection result inside the algorithm view', async ({ page }) => {
  await page.goto('/?fixture=E2');

  await page.getByRole('tab', { name: /Algorithm|Алгоритм/ }).click();
  await page.getByRole('button', { name: /START MICROPHONE|ВКЛЮЧИТЬ МИКРОФОН/ }).click();

  await expect(page.getByTestId('pipeline-live-note')).toHaveText('E2');
  await expect(page.getByTestId('pipeline-live-frequency')).toHaveText('82.4 Hz');
  await expect(page.getByTestId('pipeline-live-cents')).toContainText('0.0¢');
  await expect(page.getByTestId('pipeline-live-confidence')).toHaveText(/\d+%/);
  await expect(page.getByTestId('session-status')).toHaveAttribute('data-detector-backend', 'wasm');

  await page.getByRole('button', { name: /STOP MICROPHONE|ВЫКЛЮЧИТЬ МИКРОФОН/ }).click();
  await expect(page.getByTestId('pipeline-live-note')).toHaveText('—');
  await expect(page.getByTestId('pipeline-live-frequency')).toHaveText('—');
});
