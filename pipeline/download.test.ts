import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchPinned } from './download.ts'
import { HashMismatchError, sha256Hex } from './hash.ts'

const payload = new TextEncoder().encode('pretend this is WordNet')
const source = {
  url: 'https://example.test/wordnet.tgz',
  sha256: sha256Hex(payload),
  fileName: 'wordnet.tgz',
}

let cacheDir: string
beforeEach(async () => {
  cacheDir = await mkdtemp(path.join(tmpdir(), 'dict-cache-'))
})
afterEach(() => rm(cacheDir, { recursive: true, force: true }))

describe('fetchPinned', () => {
  it('downloads, verifies and caches', async () => {
    const fetcher = vi.fn(async () => payload)
    const result = await fetchPinned(source, cacheDir, { fetcher })
    expect(result).toEqual(payload)
    expect(await readFile(path.join(cacheDir, 'wordnet.tgz'))).toEqual(Buffer.from(payload))
  })

  it('skips the network when the cache verifies', async () => {
    await writeFile(path.join(cacheDir, source.fileName), payload)
    const fetcher = vi.fn(async () => payload)
    await fetchPinned(source, cacheDir, { fetcher })
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('discards a corrupt cache entry and re-downloads', async () => {
    await writeFile(path.join(cacheDir, source.fileName), 'corrupt')
    const fetcher = vi.fn(async () => payload)
    await fetchPinned(source, cacheDir, { fetcher })
    expect(fetcher).toHaveBeenCalledOnce()
    expect(await readFile(path.join(cacheDir, source.fileName))).toEqual(Buffer.from(payload))
  })

  it('fails on a hash mismatch without retrying or caching', async () => {
    const fetcher = vi.fn(async () => new TextEncoder().encode('tampered'))
    await expect(fetchPinned(source, cacheDir, { fetcher })).rejects.toThrow(HashMismatchError)
    expect(fetcher).toHaveBeenCalledOnce()
    await expect(readFile(path.join(cacheDir, source.fileName))).rejects.toThrow()
  })

  it('retries transient network errors', async () => {
    const fetcher = vi
      .fn<() => Promise<Uint8Array>>()
      .mockRejectedValueOnce(new Error('ECONNRESET'))
      .mockResolvedValueOnce(payload)
    const result = await fetchPinned(source, cacheDir, { fetcher, retryDelayMs: 0 })
    expect(result).toEqual(payload)
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('gives up after repeated network errors', async () => {
    const fetcher = vi.fn(async () => {
      throw new Error('ECONNRESET')
    })
    await expect(
      fetchPinned(source, cacheDir, { fetcher, retryDelayMs: 0 })
    ).rejects.toThrow(/Could not download/)
    expect(fetcher).toHaveBeenCalledTimes(3)
  })
})
