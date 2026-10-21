import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { HashMismatchError, verifySha256 } from './hash.ts'

export interface PinnedSource {
  url: string
  sha256: string
  fileName: string
}

export type Fetcher = (url: string) => Promise<Uint8Array>

const RETRIES = 3

export const defaultFetcher: Fetcher = async url => {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`GET ${url} failed: ${response.status} ${response.statusText}`)
  }
  return new Uint8Array(await response.arrayBuffer())
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const readIfPresent = async (file: string) => {
  try {
    return new Uint8Array(await readFile(file))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined
    throw error
  }
}

/**
 * Returns the bytes of the pinned source, verified against its SHA-256.
 *
 * A cached copy is reused only if it still verifies; a corrupt cache entry is
 * discarded and re-downloaded. Network errors are retried, but a hash mismatch
 * on freshly downloaded bytes is never retried or cached: it throws.
 */
export const fetchPinned = async (
  source: PinnedSource,
  cacheDir: string,
  {
    fetcher = defaultFetcher,
    log = () => {},
    retryDelayMs = 2000,
  }: { fetcher?: Fetcher; log?: (message: string) => void; retryDelayMs?: number } = {}
): Promise<Uint8Array> => {
  const cached = path.join(cacheDir, source.fileName)

  const cachedBytes = await readIfPresent(cached)
  if (cachedBytes) {
    try {
      verifySha256(cachedBytes, source.sha256, `cached ${source.fileName}`)
      log(`Using cached ${source.fileName} (hash verified)`)
      return cachedBytes
    } catch (error) {
      if (!(error instanceof HashMismatchError)) throw error
      log(`Cached ${source.fileName} failed verification; re-downloading`)
      await rm(cached, { force: true })
    }
  }

  let lastError: unknown
  for (let attempt = 1; attempt <= RETRIES; attempt++) {
    try {
      log(`Downloading ${source.url} (attempt ${attempt}/${RETRIES})`)
      const bytes = await fetcher(source.url)
      verifySha256(bytes, source.sha256, source.url)

      await mkdir(cacheDir, { recursive: true })
      const partial = `${cached}.${process.pid}.part`
      await writeFile(partial, bytes)
      await rename(partial, cached)
      return bytes
    } catch (error) {
      if (error instanceof HashMismatchError) throw error
      lastError = error
      if (attempt < RETRIES) await sleep(retryDelayMs * attempt)
    }
  }
  throw new Error(`Could not download ${source.url}: ${String(lastError)}`, {
    cause: lastError,
  })
}
