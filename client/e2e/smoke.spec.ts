import { test, expect } from '@playwright/test';

test('has title and renders correctly', async ({ page }) => {
  await page.goto('/');

  // Assuming the title is 'Terra'
  await expect(page).toHaveTitle(/Terra/i);

  // Check that the Create Board button is visible
  // Based on QUICKSTART.md, there is a "Create Board" button
  await expect(page.getByRole('button', { name: /Create Board/i })).toBeVisible();
});
