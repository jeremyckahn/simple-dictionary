import { expect, test } from '@playwright/test'
import { downloadDictionary, searchBox } from './helpers.ts'
import { startReencodingServer } from './reencoding-server.ts'

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
  expect(downloads).toBeGreaterThan(0)
})

test('resumes an interrupted download without refetching finished parts', async ({ page }) => {
  const requested: string[] = []
  let truncated = false

  await page.route(dictionaryFile, async route => {
    const file = new URL(route.request().url()).pathname.split('/').pop()!

    requested.push(file)

    // Cut the third part short, once.
    if (!file.endsWith('.2.bin') || truncated) return route.continue()

    truncated = true

    const response = await route.fetch()
    const body = await response.body()

    await route.fulfill({ response, body: body.subarray(0, body.length / 2) })
  })

  await page.goto('./')
  await page.getByRole('button', { name: 'Download', exact: true }).click()
  await expect(page.getByText(/ended before all data was received/)).toBeVisible()

  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.getByText(/previous download was interrupted/)).toBeVisible()
  await page.getByRole('button', { name: 'Resume download' }).click()

  await expect(searchBox(page)).toBeVisible()

  const count = (suffix: string) => requested.filter(f => f.endsWith(suffix)).length

  expect(count('.0.bin')).toBe(1)
  expect(count('.1.bin')).toBe(1)
  expect(count('.2.bin')).toBe(2)

  await searchBox(page).fill('ran')
  await searchBox(page).press('Enter')
  await expect(page.getByRole('heading', { level: 1, name: 'run' })).toBeVisible()
})

// GitHub Pages and Vercel compress downloads again on the fly for any client
// that accepts gzip, and the browser undoes it. `vite preview` doesn't, so use
// a server that behaves like those hosts.
test('downloads correctly from a host that re-compresses the data files', async ({ page }) => {
  const { server, url } = await startReencodingServer(process.env.BASE_PATH ?? '/')
  const encodings: Array<string | undefined> = []

  page.on('response', async response => {
    if (/\.bin$/.test(response.url())) encodings.push(await response.headerValue('content-encoding') ?? undefined)
  })

  try {
    await page.goto(url)
    await downloadDictionary(page)
    await searchBox(page).fill('ran')
    await searchBox(page).press('Enter')
    await expect(page.getByRole('heading', { level: 1, name: 'run' })).toBeVisible()
  } finally {
    server.close()
  }

  // The server really did re-encode, so this exercised the transparent decoding.
  expect(encodings.length).toBeGreaterThan(1)
  expect(encodings.every(e => e === 'gzip')).toBe(true)
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
