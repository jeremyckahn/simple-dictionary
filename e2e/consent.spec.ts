import { expect, test } from '@playwright/test'
import { downloadDictionary, searchBox } from './helpers.ts'

const dictionaryFile = '**/dictionary.*.bin'

test('declining explains why there is no search, and the user can change their mind', async ({ page }) => {
  let downloads = 0

  await page.route(dictionaryFile, route => {
    downloads++

    return route.continue()
  })
  await page.goto('./')
  await page.getByRole('button', { name: 'Not now' }).click()

  await expect(page.getByText(/can't search until/)).toBeVisible()
  await expect(searchBox(page)).toHaveCount(0)
  expect(downloads).toBe(0)

  await page.getByRole('button', { name: /Download later/ }).click()
  await downloadDictionary(page)
  expect(downloads).toBe(1)
})

test('resumes an interrupted download instead of restarting', async ({ page }) => {
  const ranges: Array<string | undefined> = []
  let first = true

  await page.route(dictionaryFile, async route => {
    ranges.push(route.request().headers().range)

    if (!first) return route.continue()

    first = false

    // Deliver only the first 2 MB of the file, then end the response early.
    const response = await route.fetch()
    const body = await response.body()

    await route.fulfill({ response, body: body.subarray(0, 2 * 1024 * 1024) })
  })

  await page.goto('./')
  await page.getByRole('button', { name: 'Download', exact: true }).click()
  await expect(page.getByText(/ended before all data was received/)).toBeVisible()

  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.getByText(/previous download was interrupted/)).toBeVisible()
  await page.getByRole('button', { name: 'Resume download' }).click()

  await expect(searchBox(page)).toBeVisible()
  expect(ranges[0]).toBeUndefined()
  expect(ranges[1]).toMatch(/^bytes=\d+-$/)
  expect(Number(ranges[1]!.match(/\d+/)![0])).toBeGreaterThan(0)

  await searchBox(page).fill('ran')
  await searchBox(page).press('Enter')
  await expect(page.getByRole('heading', { level: 1, name: 'run' })).toBeVisible()
})

test('cancelling a download returns to the consent screen without installing anything', async ({ page }) => {
  await page.route(dictionaryFile, async route => {
    // Hold the response so the progress screen stays up long enough to cancel.
    await new Promise(resolve => setTimeout(resolve, 1500))
    await route.continue()
  })
  await page.goto('./')
  await page.getByRole('button', { name: 'Download', exact: true }).click()
  await expect(page.getByRole('progressbar', { name: 'Download progress' })).toBeVisible()
  await page.getByRole('button', { name: 'Cancel' }).click()

  await expect(page.getByRole('button', { name: /^(Download|Resume download)$/ })).toBeVisible()
  await expect(searchBox(page)).toHaveCount(0)
})
