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
  it('downloads, verifies and installs, reporting progress', async () => {
    const { fetchFn, manifest } = await serveFixture()
    const db = await openStore(freshDbName())
    const onProgress = vi.fn()

    await downloadAndInstall(db, manifest, { fetchFn, onProgress })

    const last = onProgress.mock.calls.at(-1)![0]

    expect(last).toEqual({ receivedBytes: manifest.compressedBytes, totalBytes: manifest.compressedBytes })
    expect((await getInstalled(db))?.manifest.version).toBe(manifest.version)
    expect(await getPartial(db)).toBeUndefined()
    expect((await Dictionary.open(db))?.wordCount).toBe(7)
  })

  it('resumes an interrupted download with a Range request', async () => {
    const served = await serveFixture({ failAfterBytes: 100 })
    const db = await openStore(freshDbName())

    await expect(
      downloadAndInstall(db, served.manifest, { fetchFn: served.fetchFn })
    ).rejects.toThrow(TypeError)

    expect((await getPartial(db))?.receivedBytes).toBe(96)

    await downloadAndInstall(db, served.manifest, { fetchFn: served.fetchFn })

    expect(served.requests.at(-1)![1]).toBe('bytes=96-')
    expect((await Dictionary.open(db))?.wordCount).toBe(7)
  })

  it('keeps partial data when the caller stops mid-download, then resumes', async () => {
    const served = await serveFixture()
    const db = await openStore(freshDbName())
    let calls = 0

    await expect(
      downloadAndInstall(db, served.manifest, {
        fetchFn: served.fetchFn,
        onProgress: () => {
          if (++calls === 4) throw new Error('cancelled')
        },
      })
    ).rejects.toThrow('cancelled')

    const partial = await getPartial(db)

    expect(partial?.receivedBytes).toBeGreaterThan(0)
    expect(partial!.receivedBytes).toBeLessThan(served.manifest.compressedBytes)

    await downloadAndInstall(db, served.manifest, { fetchFn: served.fetchFn })

    expect(served.requests.at(-1)![1]).toBe(`bytes=${partial!.receivedBytes}-`)
    expect(await Dictionary.open(db)).toBeDefined()
  })

  it('restarts when the server ignores Range', async () => {
    const served = await serveFixture({ failAfterBytes: 100, ignoreRange: true })
    const db = await openStore(freshDbName())

    await downloadAndInstall(db, served.manifest, { fetchFn: served.fetchFn }).catch(() => {})
    await downloadAndInstall(db, served.manifest, { fetchFn: served.fetchFn })

    expect((await Dictionary.open(db))?.wordCount).toBe(7)
  })

  it('discards a partial download of a different version', async () => {
    const stale = await serveFixture({ failAfterBytes: 100 })
    const db = await openStore(freshDbName())

    await downloadCompressed(db, stale.manifest, { fetchFn: stale.fetchFn }).catch(() => {})

    const fresh = await serveFixture()
    const manifest = { ...fresh.manifest, version: 'newversion' }

    await downloadAndInstall(db, manifest, { fetchFn: fresh.fetchFn })

    expect(fresh.requests[0][1]).toBeUndefined()
  })

  it('fails clearly when a server applies content encoding to the file', async () => {
    const served = await serveFixture({ contentEncoding: true })
    const db = await openStore(freshDbName())

    await expect(
      downloadAndInstall(db, served.manifest, { fetchFn: served.fetchFn })
    ).rejects.toThrow(/content encoding/)
  })

  it('rejects corrupt data and leaves nothing installed or partial', async () => {
    const served = await serveFixture({ corrupt: true })
    const db = await openStore(freshDbName())

    await expect(
      downloadAndInstall(db, served.manifest, { fetchFn: served.fetchFn })
    ).rejects.toThrow(/verification/)

    expect(await getInstalled(db)).toBeUndefined()
    expect(await getPartial(db)).toBeUndefined()
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
