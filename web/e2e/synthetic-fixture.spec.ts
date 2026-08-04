import { expect, test } from '@playwright/test';

test('detects E2 through the synthetic fixture without microphone access', async ({ page }) => {
  await page.goto('/?fixture=E2');

  await page.getByTestId('mic-toggle').click();

  await expect(page.getByTestId('session-status')).toContainText(/LISTENING|СЛУШАЕТ/);
  await expect(page.getByTestId('detected-note')).toHaveText('E2');
  await expect(page.getByTestId('detected-frequency')).toHaveText('82.4');
  await expect(page.getByTestId('note-confidence')).toContainText(/уверенность|confidence/i);
  await expect(page.getByTestId('session-status')).toHaveAttribute('data-detector-backend', 'wasm');

  await page.getByTestId('mic-toggle').click();
  await expect(page.getByTestId('session-status')).toContainText(/READY|ГОТОВ/);
  await expect(page.getByTestId('detected-note')).toHaveCount(0);
});

test('streams the canonical detection result inside the algorithm view', async ({ page }) => {
  await page.goto('/?fixture=E2');

  await page.getByRole('tab', { name: /Algorithm|Алгоритм/ }).click();
  await page.getByRole('button', { name: /START MICROPHONE|ВКЛЮЧИТЬ МИКРОФОН/ }).click();

  await expect(page.getByTestId('pipeline-live-note')).toHaveText('E2');
  await expect(page.getByTestId('pipeline-live-frequency')).toHaveText('82.4 Hz');
  await expect(page.getByTestId('pipeline-live-cents')).toContainText('0.0¢');
  await expect(page.getByTestId('pipeline-live-confidence')).toHaveText(/\d+%/);
  await expect(page.getByTestId('pipeline-decision')).toHaveAttribute('data-decision', 'published');
  await expect(page.getByTestId('pipeline-candidate-yin')).toHaveAttribute('data-present', 'true');
  await expect(page.getByTestId('pipeline-candidate-yin')).toHaveAttribute('data-state', 'active');
  await expect(page.getByTestId('pipeline-candidate-secondary')).toHaveAttribute('data-present', 'true');
  await expect(page.getByTestId('pipeline-candidate-secondary')).toHaveAttribute('data-state', 'active');
  await expect(page.getByTestId('pipeline-flow-output')).toHaveAttribute('data-state', 'active');
  await expect(page.getByTestId('pipeline-chart-raw')).toHaveAttribute('d', /M.+L/);
  await expect(page.getByTestId('pipeline-chart-stable')).toHaveAttribute('d', /M.+L/);
  await expect(page.getByTestId('pipeline-chart-uncertainty')).toHaveAttribute('d', /M.+Z/);
  await expect(page.getByTestId('pipeline-spectral-panel').locator(':scope > header strong'))
    .toHaveAttribute('data-available', 'true');
  await expect(page.getByTestId('pipeline-octave-0')).toHaveAttribute('data-state', 'active');
  await expect(page.getByTestId('pipeline-noise-signal')).toHaveAttribute('d', /M.+L/);
  await expect.poll(async () => (
    page.getByTestId('pipeline-decision-timeline').locator('.timeline-track button').count()
  )).toBeGreaterThan(1);
  await expect(page.getByTestId('pipeline-frame-inspector')).toContainText(/WASM/);
  await expect(page.getByTestId('pipeline-what-if-frequency')).toHaveText('82.4 Hz');
  await expect(page.getByTestId('pipeline-evidence')).toBeVisible();
  await expect(page.getByTestId('pipeline-evidence').locator('code')).toHaveText(/[0-9A-F]{8}/);

  const captureButton = page.getByTestId('pipeline-baseline-capture');
  const captureSize = await captureButton.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(captureSize.scrollWidth).toBeLessThanOrEqual(captureSize.clientWidth);

  const dcInfoButton = page.getByTestId('pipeline-info-dc-removal');
  const dcInfoPanel = page.getByTestId('pipeline-info-panel-dc-removal');
  await dcInfoButton.click();
  await expect(dcInfoPanel).toBeVisible();
  const infoBounds = await dcInfoPanel.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      bottom: rect.bottom,
      left: rect.left,
      right: rect.right,
      top: rect.top,
      viewportHeight: window.innerHeight,
      viewportWidth: window.innerWidth,
    };
  });
  expect(infoBounds.left).toBeGreaterThanOrEqual(0);
  expect(infoBounds.top).toBeGreaterThanOrEqual(0);
  expect(infoBounds.right).toBeLessThanOrEqual(infoBounds.viewportWidth);
  expect(infoBounds.bottom).toBeLessThanOrEqual(infoBounds.viewportHeight);
  await dcInfoButton.click();
  await expect(dcInfoPanel).toBeHidden();

  await page.getByTestId('pipeline-freeze-toggle').click();
  await expect(page.getByTestId('pipeline-frame-inspector'))
    .toContainText(/заморожен|frozen/i);
  const frozenFrameId = await page.getByTestId('pipeline-frame-inspector').locator('dd').first().textContent();
  await page.waitForTimeout(120);
  await expect(page.getByTestId('pipeline-frame-inspector').locator('dd').first())
    .toHaveText(frozenFrameId ?? '');
  await page.getByTestId('pipeline-baseline-capture').click();
  await expect(page.getByTestId('pipeline-baseline-comparison')).toBeVisible();
  await expect(page.getByTestId('pipeline-chart-baseline')).toHaveAttribute('y1', /\d/);

  await page.getByTestId('pipeline-freeze-toggle').click();
  await page.getByRole('checkbox', { name: 'MPM / secondary' }).uncheck();
  await expect(page.getByTestId('pipeline-candidate-secondary')).toHaveAttribute('data-present', 'false');
  await expect(page.getByTestId('pipeline-candidate-yin')).toHaveAttribute('data-state', 'active');
  await expect(page.getByTestId('pipeline-decision')).toHaveAttribute('data-decision', 'published');
  await expect(page.getByTestId('session-status')).toHaveAttribute('data-detector-backend', 'wasm');

  await page.getByRole('button', { name: /STOP MICROPHONE|ВЫКЛЮЧИТЬ МИКРОФОН/ }).click();
  await expect(page.getByTestId('pipeline-live-note')).toHaveText('—');
  await expect(page.getByTestId('pipeline-live-frequency')).toHaveText('—');
});

test('turns octave measurements into a concrete intonation adjustment', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?fixture=E2');
  await page.getByTestId('mic-toggle').click();
  await page.getByRole('tab', { name: /Analysis|Анализ/ }).click();

  const panel = page.getByTestId('intonation-setup');
  await expect(panel).toBeVisible();
  await expect(page.locator('.visual-canvas').first()).toBeVisible();
  await panel.locator('input').nth(0).fill('82.4069');
  await panel.locator('input').nth(1).fill('164.8138');
  await panel.locator('input').nth(2).fill('166');

  await expect(panel).toContainText(/увеличьте|increase/i);
  await expect(panel).toContainText(/\+12\./);
  const viewportWidth = await page.evaluate(() => document.documentElement.clientWidth);
  const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(documentWidth).toBe(viewportWidth);
});

test('keeps metadata, diagnostics and ear-training state coherent', async ({ page }) => {
  await page.goto('/?fixture=E2');

  const initialLang = await page.locator('html').getAttribute('lang');
  expect(['ru', 'en']).toContain(initialLang);
  await page.getByRole('button', { name: /Toggle language|Переключить язык/ }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', initialLang === 'ru' ? 'en' : 'ru');

  await expect(page.locator('canvas')).toHaveCount(0);
  await page.getByRole('tab', { name: /Practice|Практика/ }).click();
  const correct = page.locator('[data-ear-action="correct"]');
  await expect(correct).toBeDisabled();
  await page.locator('[data-ear-action="next"]').click();
  await expect(correct).toBeEnabled();
  await correct.click();
  await expect(correct).toBeDisabled();
});
