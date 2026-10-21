import { expect, test } from '@playwright/test'
import { downloadDictionary, searchBox, waitForServiceWorker } from './helpers.ts'

const isDictionaryFile = (url: string) => /\/dictionary\.[0-9a-f]+\.bin$/.test(new URL(url).pathname)

test('asks before downloading, then works fully offline', async ({ page, context }) => {
  const dictionaryRequests: string[] = []

  page.on('request', request => {
    if (isDictionaryFile(request.url())) dictionaryRequests.push(request.url())
  })

  await page.goto('./')

  // Consent comes first, with the exact size; nothing is downloaded yet.
  await expect(page.getByText(/The download is\s+\d+(\.\d)? MB/)).toBeVisible()
  await waitForServiceWorker(page)
  expect(dictionaryRequests).toEqual([])

  await downloadDictionary(page)
  expect(dictionaryRequests).toHaveLength(1)

  // Go offline and reload: the app shell comes from the service worker and the
  // dictionary from IndexedDB.
  await context.setOffline(true)
  await page.reload()
  await expect(searchBox(page)).toBeVisible()

  // Prefix suggestions.
  await searchBox(page).fill('dictio')
  await expect(page.getByRole('option', { name: 'dictionary', exact: true })).toBeVisible()

  // Inflection resolution: "ran" -> "run".
  await searchBox(page).fill('ran')
  await searchBox(page).press('Enter')
  await expect(page.getByRole('heading', { level: 1, name: 'run' })).toBeVisible()
  await expect(page.getByText('“ran” is a form of “run”')).toBeVisible()
  await expect(page).toHaveURL(/\?q=ran$/)

  // A deep link opened while offline.
  await page.goto('./?q=mice')
  await expect(page.getByRole('heading', { level: 1, name: 'mouse' })).toBeVisible()
  await expect(searchBox(page)).toHaveValue('mice')

  // Tapping a synonym looks it up, and back returns to the previous entry.
  await page.getByRole('button', { name: 'computer mouse' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'computer mouse' })).toBeVisible()
  await page.goBack()
  await expect(page.getByRole('heading', { level: 1, name: 'mouse' })).toBeVisible()

  // Nothing was fetched from the network for any of this.
  expect(dictionaryRequests).toHaveLength(1)
})

test('keeps the dictionary in a new browser tab after the first download', async ({ page, context }) => {
  await page.goto('./')
  await downloadDictionary(page)

  const second = await context.newPage()

  await second.goto('./?q=dictionary')
  await expect(second.getByRole('heading', { level: 1, name: 'dictionary' })).toBeVisible()
  await expect(second.getByRole('button', { name: 'Download', exact: true })).toHaveCount(0)
})
