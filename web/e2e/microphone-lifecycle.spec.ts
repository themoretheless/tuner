import { expect, test } from '@playwright/test';

import {
  disconnectFakeMicrophone,
  fakeMicrophoneRequestCount,
  installFakeMicrophone,
  setFakeMicrophoneDevices,
} from './support/fakeMicrophone';

test('recovers after microphone permission is denied', async ({ page }) => {
  await installFakeMicrophone(page, { denyFirstRequest: true });
  await page.goto('/');

  await page.getByTestId('mic-toggle').click();
  await expect(page.getByRole('alert')).toContainText('Allow microphone access');
  await expect(page.getByTestId('session-status')).toContainText(/ERROR|ОШИБКА/);

  await page.getByTestId('mic-toggle').click();
  await expect(page.getByTestId('session-status')).toContainText(/LISTENING|СЛУШАЕТ/);
  expect(await fakeMicrophoneRequestCount(page)).toBe(2);
});

test('reports a disconnected microphone and restarts cleanly', async ({ page }) => {
  await installFakeMicrophone(page);
  await page.goto('/');
  await page.getByTestId('mic-toggle').click();
  await expect(page.getByTestId('session-status')).toContainText(/LISTENING|СЛУШАЕТ/);

  await disconnectFakeMicrophone(page);
  await expect(page.getByRole('alert')).toContainText('Microphone disconnected');
  await expect(page.getByTestId('session-status')).toContainText(/ERROR|ОШИБКА/);

  await page.getByTestId('mic-toggle').click();
  await expect(page.getByTestId('session-status')).toContainText(/LISTENING|СЛУШАЕТ/);
  expect(await fakeMicrophoneRequestCount(page)).toBe(2);
});

test('keeps the selected microphone across a transient devicechange', async ({ page }) => {
  await installFakeMicrophone(page);
  await page.goto('/');
  await page.getByTestId('mic-toggle').click();
  const selector = page.getByRole('combobox', { name: /input|вход/i });
  const refreshButton = page.getByRole('button', { name: /refresh|обновить/i });
  await expect(selector.locator('option')).toHaveCount(3);
  await expect(refreshButton).toBeVisible();
  await expect.poll(async () => refreshButton.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    return { height: bounds.height, width: bounds.width };
  })).toEqual({ height: 32, width: 32 });
  await selector.selectOption('preferred-mic');
  await expect(selector).toHaveValue('preferred-mic');

  await setFakeMicrophoneDevices(page, [
    { deviceId: 'fallback-mic', label: 'Fallback microphone' },
  ]);
  await expect(selector).toHaveValue('preferred-mic');
  await expect(selector.locator('option:checked'))
    .toContainText(/Saved microphone unavailable|Сохранённый микрофон недоступен/);

  await setFakeMicrophoneDevices(page, [
    { deviceId: 'preferred-mic', label: 'Preferred microphone' },
    { deviceId: 'fallback-mic', label: 'Fallback microphone' },
  ]);
  await expect(selector).toHaveValue('preferred-mic');
  await expect(selector.locator('option:checked')).toHaveText('Preferred microphone');
});
