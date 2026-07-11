import { expect, test } from '@playwright/test';

test('library tabs preserve a focused, overflow-free workflow', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/');
  await page.getByRole('tab', { name: /Library|Библиотека/ }).click();

  await expect(page.getByTestId('library-panel-setup')).toBeVisible();
  await expect(page.getByTestId('library-panel-custom')).toBeHidden();

  const customTab = page.getByTestId('library-tab-custom');
  await customTab.click();
  await expect(customTab).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId('library-panel-custom')).toBeVisible();
  await expect(page.getByTestId('library-panel-setup')).toBeHidden();

  await customTab.press('Home');
  await expect(page.getByTestId('library-tab-setup')).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId('library-panel-setup')).toBeVisible();

  const hasOverflow = await page.evaluate(() => (
    document.documentElement.scrollWidth > document.documentElement.clientWidth
  ));
  expect(hasOverflow).toBe(false);
});
