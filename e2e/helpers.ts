import { expect, type Page } from '@playwright/test'

export const searchBox = (page: Page) =>
  page.getByRole('combobox', { name: 'Search the dictionary' })

/** Resolves once a service worker controls the page (the app shell is precached). */
export const waitForServiceWorker = async (page: Page) => {
  await page.evaluate(() => navigator.serviceWorker.ready)
  // The first load isn't controlled; a reload is.
  await page.reload()
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)
}

/** Accepts the consent screen and waits for the dictionary to be installed. */
export const downloadDictionary = async (page: Page) => {
  await page.getByRole('button', { name: 'Download', exact: true }).click()
  await expect(searchBox(page)).toBeVisible()
}
