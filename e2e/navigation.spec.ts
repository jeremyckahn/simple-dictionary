import { expect, test } from '@playwright/test'
import { downloadDictionary, searchBox } from './helpers.ts'

const search = async (page: import('@playwright/test').Page, word: string) => {
  await searchBox(page).fill(word)
  await searchBox(page).press('Enter')
  await expect(page.getByRole('heading', { level: 1, name: word })).toBeVisible()
}

test('the banner returns to the home page', async ({ page }) => {
  await page.goto('./')
  await downloadDictionary(page)
  await search(page, 'dictionary')
  await expect(page).toHaveURL(/\?q=dictionary$/)

  await page.getByRole('link', { name: 'Simple Dictionary' }).click()

  await expect(page).not.toHaveURL(/\?q=/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(0)
  await expect(page.getByText(/A quiet little dictionary/)).toBeVisible()
  await expect(searchBox(page)).toHaveValue('')
  await expect(searchBox(page)).toBeFocused()

  // The entry is still one step back.
  await page.goBack()
  await expect(page.getByRole('heading', { level: 1, name: 'dictionary' })).toBeVisible()
})

test('words can be removed from the history, and stay removed', async ({ page }) => {
  await page.goto('./')
  await downloadDictionary(page)
  await search(page, 'dictionary')
  await search(page, 'mouse')
  await page.getByRole('link', { name: 'Simple Dictionary' }).click()

  // The home page shows the history (newest first).
  const options = page.getByRole('option')

  await expect(options).toHaveText(['mouse', 'dictionary'])

  // A real mouse click removes the word, leaves the list open, and doesn't search.
  await page.getByRole('button', { name: 'Remove “mouse” from history' }).click()
  await expect(options).toHaveText(['dictionary'])
  await expect(page).not.toHaveURL(/\?q=/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(0)

  // Keyboard: highlight the last one and press Shift+Delete.
  await searchBox(page).press('ArrowDown')
  await searchBox(page).press('Shift+Delete')
  await expect(options).toHaveCount(0)

  // It persists across a reload.
  await page.reload()
  await expect(searchBox(page)).toBeVisible()
  await searchBox(page).click()
  await expect(options).toHaveCount(0)
})
