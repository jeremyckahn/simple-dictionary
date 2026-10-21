import 'fake-indexeddb/auto'
import { describe, expect, it, vi } from 'vitest'
import { Dictionary } from './dictionary.ts'
import { DownloadError, downloadAndInstall, downloadCompressed, fetchManifest } from './download.ts'
import { getInstalled, getPartial, openStore } from './store.ts'
import { freshDbName, serveFixture } from './test-utils.ts'

describe('fetchManifest', () => {
  it('loads the manifest', async () => {
    const { fetchFn, manifest } = await serveFixture()

    expect(await fetchManifest(fetchFn)).toEqual(manifest)
  })

  it('rejects an unsupported format', async () => {
    const fetchFn = (async () => Response.json({ format: 99 })) as typeof fetch

    await expect(fetchManifest(fetchFn)).rejects.toThrow(DownloadError)
  })

  it('rejects an HTTP error', async () => {
    const fetchFn = (async () => new Response('', { status: 404 })) as typeof fetch

    await expect(fetchManifest(fetchFn)).rejects.toThrow(/404/)
  })
})

describe('downloadAndInstall', () => {
  it('downloads every part, verifies and installs, reporting progress', async () => {
    const { fetchFn, manifest, requests } = await serveFixture()
    const db = await openStore(freshDbName())
    const onProgress = vi.fn()

    await downloadAndInstall(db, manifest, { fetchFn, onProgress })

    expect(manifest.parts.length).toBeGreaterThan(2)
    expect(requests).toEqual(manifest.parts.map(p => p.file))

    const reported = onProgress.mock.calls.map(([p]) => p.receivedBytes)

    expect(reported).toEqual([...reported].sort((x, y) => x - y))
    expect(onProgress.mock.calls.at(-1)![0]).toEqual({
      receivedBytes: manifest.compressedBytes,
      totalBytes: manifest.compressedBytes,
    })
    expect((await getInstalled(db))?.manifest.version).toBe(manifest.version)
    expect(await getPartial(db)).toBeUndefined()
    expect((await Dictionary.open(db))?.wordCount).toBe(7)
  })

  it('resumes after a network failure, refetching only the interrupted part onward', async () => {
    const served = await serveFixture({ failPart: { index: 2, afterBytes: 40 } })
    const db = await openStore(freshDbName())

    await expect(
      downloadAndInstall(db, served.manifest, { fetchFn: served.fetchFn })
    ).rejects.toThrow()

    const partial = await getPartial(db)

    expect(partial).toMatchObject({ chunkCount: 2, receivedBytes: 200 })

    served.requests.length = 0
    await downloadAndInstall(db, served.manifest, { fetchFn: served.fetchFn })

    expect(served.requests).toEqual(served.manifest.parts.slice(2).map(p => p.file))
    expect((await Dictionary.open(db))?.wordCount).toBe(7)
  })

  it('treats a truncated part as an interrupted download', async () => {
    const served = await serveFixture()
    const truncating = (async (input: RequestInfo | URL) => {
      const response = await served.fetchFn(input)

      return String(input).endsWith('.1.bin')
        ? new Response((await response.arrayBuffer()).slice(0, 30))
        : response
    }) as typeof fetch
    const db = await openStore(freshDbName())

    await expect(
      downloadAndInstall(db, served.manifest, { fetchFn: truncating })
    ).rejects.toThrow(/ended before all data/)

    expect((await getPartial(db))?.chunkCount).toBe(1)
  })

  it('keeps finished parts when the caller stops mid-download, then resumes', async () => {
    const served = await serveFixture()
    const db = await openStore(freshDbName())

    await expect(
      downloadAndInstall(db, served.manifest, {
        fetchFn: served.fetchFn,
        onProgress: ({ receivedBytes }) => {
          if (receivedBytes >= 150) throw new Error('cancelled')
        },
      })
    ).rejects.toThrow('cancelled')

    expect(await getPartial(db)).toMatchObject({ chunkCount: 1, receivedBytes: 100 })

    served.requests.length = 0
    await downloadAndInstall(db, served.manifest, { fetchFn: served.fetchFn })

    expect(served.requests[0]).toBe(served.manifest.parts[1].file)
    expect(served.requests).not.toContain(served.manifest.parts[0].file)
    expect(await Dictionary.open(db)).toBeDefined()
  })

  it('discards a partial download of a different version', async () => {
    const stale = await serveFixture({ failPart: { index: 1, afterBytes: 20 } })
    const db = await openStore(freshDbName())

    await downloadCompressed(db, stale.manifest, { fetchFn: stale.fetchFn }).catch(() => {})

    expect((await getPartial(db))?.chunkCount).toBe(1)

    const fresh = await serveFixture()

    await downloadAndInstall(db, { ...fresh.manifest, version: 'newversion' }, { fetchFn: fresh.fetchFn })

    expect(fresh.requests[0]).toBe(fresh.manifest.parts[0].file)
  })

  it('discards a partial download made with a different part layout', async () => {
    const stale = await serveFixture({ failPart: { index: 2, afterBytes: 20 } })
    const db = await openStore(freshDbName())

    await downloadCompressed(db, stale.manifest, { fetchFn: stale.fetchFn }).catch(() => {})

    const fresh = await serveFixture()
    const manifest = { ...fresh.manifest, parts: fresh.manifest.parts.slice(0, -1) }

    await downloadCompressed(db, manifest, { fetchFn: fresh.fetchFn }).catch(() => {})

    expect(fresh.requests[0]).toBe(fresh.manifest.parts[0].file)
  })

  it('does not care that a host re-encodes responses (the browser undoes it)', async () => {
    const served = await serveFixture({ contentEncoding: true })
    const db = await openStore(freshDbName())

    await downloadAndInstall(db, served.manifest, { fetchFn: served.fetchFn })

    expect((await Dictionary.open(db))?.wordCount).toBe(7)
  })

  it('rejects a part that fails its hash and stores nothing from it', async () => {
    const served = await serveFixture({ corrupt: true })
    const db = await openStore(freshDbName())

    await expect(
      downloadAndInstall(db, served.manifest, { fetchFn: served.fetchFn })
    ).rejects.toThrow(/verification/)

    expect(served.requests).toHaveLength(1)
    expect(await getInstalled(db)).toBeUndefined()
    expect(await getPartial(db)).toBeUndefined()
  })

  it('fails on an HTTP error for a part', async () => {
    const served = await serveFixture()
    const failing = (async (input: RequestInfo | URL) =>
      String(input).endsWith('.1.bin') ? new Response('', { status: 503 }) : served.fetchFn(input)) as typeof fetch
    const db = await openStore(freshDbName())

    await expect(downloadAndInstall(db, served.manifest, { fetchFn: failing })).rejects.toThrow(/503/)
    expect((await getPartial(db))?.chunkCount).toBe(1)
  })

  it('keeps the existing dictionary when an update fails', async () => {
    const ok = await serveFixture()
    const db = await openStore(freshDbName())

    await downloadAndInstall(db, ok.manifest, { fetchFn: ok.fetchFn })

    const bad = await serveFixture({ corrupt: true })

    await downloadAndInstall(db, { ...bad.manifest, version: 'v2' }, { fetchFn: bad.fetchFn }).catch(() => {})

    expect((await getInstalled(db))?.manifest.version).toBe(ok.manifest.version)
    expect((await Dictionary.open(db))?.wordCount).toBe(7)
  })
})
