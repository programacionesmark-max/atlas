import { expect, test } from '@playwright/test';

test('two independent clients share the authoritative game and reconnect', async ({ browser }) => {
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();
  const host = await hostContext.newPage();
  let guest = await guestContext.newPage();

  await host.goto('/');
  await host.getByLabel('Nickname').fill('Maya E2E');
  await host.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(host).toHaveURL(/\/room\/[A-Z0-9]{6}$/);

  const invitationPath = new URL(host.url()).pathname.replace('/room/', '/join/');
  await guest.goto(invitationPath);
  await guest.getByLabel('Nickname').fill('Noor E2E');
  await guest.getByRole('button', { name: 'Join game', exact: true }).click();
  await expect(guest).toHaveURL(/\/room\/[A-Z0-9]{6}$/);
  expect(new URL(guest.url()).pathname).toBe(new URL(host.url()).pathname);

  await expect(host.getByText('Noor E2E', { exact: true })).toBeVisible();
  await expect(guest.getByText('Maya E2E', { exact: true })).toBeVisible();

  await host.getByRole('button', { name: /ready$/i }).click();
  await guest.getByRole('button', { name: /ready$/i }).click();
  const start = host.getByRole('button', { name: 'Start game' });
  await expect(start).toBeEnabled();
  await start.click();

  await expect(host).toHaveURL(/\/game\/[a-f0-9-]+$/);
  await expect(guest).toHaveURL(/\/game\/[a-f0-9-]+$/);
  expect(new URL(guest.url()).pathname).toBe(new URL(host.url()).pathname);
  await expect(host.getByText('State #1', { exact: true })).toBeVisible();
  await expect(guest.getByText('State #1', { exact: true })).toBeVisible();

  await host.getByRole('button', { name: 'Roll dice' }).click();
  const hostDice = host.locator('.dice-pair');
  const guestDice = guest.locator('.dice-pair');
  await expect(hostDice).not.toHaveAttribute('aria-label', 'Dice not rolled');
  const synchronizedRoll = await hostDice.getAttribute('aria-label');
  expect(synchronizedRoll).toBeTruthy();
  await expect(guestDice).toHaveAttribute('aria-label', synchronizedRoll!);

  const gameUrl = guest.url();
  await guest.close();
  guest = await guestContext.newPage();
  await guest.goto(gameUrl);
  await expect(guest.getByText('State #2', { exact: true })).toBeVisible();
  await expect(guest.getByText('Noor E2E', { exact: true })).toBeVisible();

  await guestContext.close();
  await hostContext.close();
});

test('two mobile clients can complete the lobby and first synchronized turn without overflow', async ({
  browser
}) => {
  const mobile = { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true };
  const hostContext = await browser.newContext(mobile);
  const guestContext = await browser.newContext(mobile);
  const host = await hostContext.newPage();
  const guest = await guestContext.newPage();

  await host.goto('/');
  await host.getByLabel('Nickname').fill('Maya Mobile');
  await host.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(host).toHaveURL(/\/room\/[A-Z0-9]{6}$/);

  await guest.goto('/');
  await guest.getByLabel('Nickname').fill('Noor Mobile');
  await guest.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(guest).toHaveURL(/\/room\/[A-Z0-9]{6}$/);
  expect(new URL(guest.url()).pathname).toBe(new URL(host.url()).pathname);

  await host.getByRole('button', { name: /ready$/i }).click();
  await guest.getByRole('button', { name: /ready$/i }).click();
  await host.getByRole('button', { name: 'Start game' }).click();
  await expect(host).toHaveURL(/\/game\/[a-f0-9-]+$/);
  await expect(guest).toHaveURL(/\/game\/[a-f0-9-]+$/);
  await expect(host.getByRole('button', { name: 'Roll dice' })).toBeVisible();

  const horizontalOverflow = await host.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth
  );
  expect(horizontalOverflow).toBe(false);

  await host.getByRole('button', { name: 'Roll dice' }).click();
  const hostDice = host.locator('.dice-pair');
  const guestDice = guest.locator('.dice-pair');
  await expect(hostDice).not.toHaveAttribute('aria-label', 'Dice not rolled');
  const synchronizedRoll = await hostDice.getAttribute('aria-label');
  expect(synchronizedRoll).toBeTruthy();
  await expect(guestDice).toHaveAttribute('aria-label', synchronizedRoll!);

  await guestContext.close();
  await hostContext.close();
});
