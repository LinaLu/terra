import { test, expect } from '@playwright/test';

test('drag and drop 3 cards to reorder them', async ({ page }) => {
  await page.goto('/');

  // Create a unique board using the "Basic Retro" template
  const uniqueBoardName = `DnD Test Board ${Date.now()}`;
  await page.fill('input[placeholder="Enter board name"]', uniqueBoardName);
  await page.getByLabel(/Basic Retro/).check();
  await page.click('button:has-text("Create Board")');

  // Navigate to the board
  await page.click(`text=${uniqueBoardName}`);

  // Handle Join Board modal (a fixed, full-screen overlay added by the auth
  // feature; it blocks all pointer events on the board underneath until
  // dismissed, so it must be handled before interacting with columns/cards)
  await expect(page.getByRole('heading', { name: 'Join ' + uniqueBoardName })).toBeVisible({ timeout: 10000 });
  await page.fill('input[placeholder="Your name"]', 'Tester');
  await page.click('button:has-text("Join Board")');

  await page.waitForSelector(`h2:has-text("${uniqueBoardName}")`);

  await expect(page.locator('h3:has-text("Went Well")').first()).toBeVisible();

  // Wait a bit and take a screenshot to debug
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'debug-column.png' });

  // Add 3 cards
  // Scoped to div.flex-1 (the column's own root element) rather than a bare
  // `div:has(h3)`, which also matches the outer flex wrapper around all
  // columns once the board has more than one column (template boards do).
  const column = page.locator('div.flex-1', { has: page.locator('h3', { hasText: 'Went Well' }) }).first();

  const addCard = async (content: string) => {
    // Specifically target the button inside CardForm
    // Note: CardForm no longer has a per-card "Your name" input — authorship
    // now comes from the joined session (handled above via the Join Board
    // modal), so that fill step from the original test has been dropped.
    await column.locator('button', { hasText: '+ Add a card' }).first().click();
    await column.locator('textarea[placeholder="What\'s on your mind?"]').first().fill(content);
    await column.locator('button:has-text("Add card")').first().click();
    // Wait for it to appear
    await expect(page.locator(`p:has-text("${content}")`).first()).toBeVisible();
  };

  await addCard('Card A');
  await addCard('Card B');
  await addCard('Card C');

  // Let state settle
  await page.waitForTimeout(500);

  // Check initial order: A, B, C
  let cards = column.locator('[data-rfd-draggable-id], [data-rbd-draggable-id]');
  await expect(cards).toHaveCount(3);
  await expect(cards.nth(0)).toContainText('Card A');
  await expect(cards.nth(1)).toContainText('Card B');
  await expect(cards.nth(2)).toContainText('Card C');

  // Drag Card A to the bottom (below Card C) using keyboard (very reliable for @hello-pangea/dnd)
  const cardA = page.locator('[data-rfd-draggable-id], [data-rbd-draggable-id]').filter({ hasText: 'Card A' });
  await cardA.focus();
  await page.keyboard.press('Space'); // lift
  await page.waitForTimeout(200);
  await page.keyboard.press('ArrowDown'); // move past Card B
  await page.waitForTimeout(200);
  await page.keyboard.press('ArrowDown'); // move past Card C
  await page.waitForTimeout(200);
  await page.keyboard.press('Space'); // drop
  
  // Wait for backend sync
  await page.waitForTimeout(1000);

  // Check new order: B, C, A
  await expect(cards.nth(0)).toContainText('Card B');
  await expect(cards.nth(1)).toContainText('Card C');
  await expect(cards.nth(2)).toContainText('Card A');

  // Now drag Card C to the top (above Card B)
  const cardC = page.locator('[data-rfd-draggable-id], [data-rbd-draggable-id]').filter({ hasText: 'Card C' });
  await cardC.focus();
  await page.keyboard.press('Space'); // lift
  await page.waitForTimeout(200);
  await page.keyboard.press('ArrowUp'); // move past Card B
  await page.waitForTimeout(200);
  await page.keyboard.press('Space'); // drop

  await page.waitForTimeout(1000);

  // Check new order: C, B, A
  await expect(cards.nth(0)).toContainText('Card C');
  await expect(cards.nth(1)).toContainText('Card B');
  await expect(cards.nth(2)).toContainText('Card A');
});
