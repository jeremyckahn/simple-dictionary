import {
  clearPartial,
  type DictionaryStore,
  getPartial,
  installDictionary,
  putChunk,
  readChunks,
} from './store.ts'
import {
  type DictionaryFile,
  type DownloadProgress,
  type Manifest,
  SUPPORTED_FORMAT,
} from './types.ts'

// The app may be served from a sub-path (e.g. GitHub Pages project sites), so
// data URLs are relative to Vite's base rather than the domain root.
const BASE = import.meta.env.BASE_URL

export const MANIFEST_PATH = `${BASE}dictionary-manifest.json`

/** Network chunks are coalesced to roughly this size before being persisted. */
const PERSIST_EVERY_BYTES = 512 * 1024

export class DownloadError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DownloadError'
  }
}

export const fetchManifest = async (
  fetchFn: typeof fetch = fetch,
  signal?: AbortSignal
): Promise<Manifest> => {
  const response = await fetchFn(MANIFEST_PATH, { cache: 'no-cache', signal })

  if (!response.ok) {
    throw new DownloadError(`Could not load the dictionary manifest (${response.status})`)
  }

  const manifest = (await response.json()) as Manifest

  if (manifest.format !== SUPPORTED_FORMAT) {
    throw new DownloadError(
      `Dictionary format ${manifest.format} is not supported by this version of the app`
    )
  }

  return manifest
}

const toHex = (buffer: ArrayBuffer): string =>
  Array.from(new Uint8Array(buffer), b => b.toString(16).padStart(2, '0')).join('')

export const sha256Hex = async (data: Uint8Array<ArrayBuffer>): Promise<string> =>
  toHex(await crypto.subtle.digest('SHA-256', data))

const gunzip = async (data: Uint8Array<ArrayBuffer>): Promise<Uint8Array> => {
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('gzip'))

  return new Uint8Array(await new Response(stream).arrayBuffer())
}

export interface DownloadOptions {
  signal?: AbortSignal
  onProgress?: (progress: DownloadProgress) => void
  fetchFn?: typeof fetch
}

/**
 * Downloads the dictionary file described by `manifest`, resuming from
 * whatever a previous attempt persisted. Aborting (via `signal`) keeps the
 * partial data so the next call continues where this one stopped.
 * Returns the verified compressed bytes.
 */
export const downloadCompressed = async (
  db: DictionaryStore,
  manifest: Manifest,
  { signal, onProgress, fetchFn = fetch }: DownloadOptions = {}
): Promise<Uint8Array<ArrayBuffer>> => {
  const totalBytes = manifest.compressedBytes
  let partial = await getPartial(db)

  if (partial && partial.version !== manifest.version) {
    await clearPartial(db)
    partial = undefined
  }

  let receivedBytes = partial?.receivedBytes ?? 0
  let chunkIndex = partial?.chunkCount ?? 0

  if (receivedBytes < totalBytes) {
    const headers: HeadersInit = receivedBytes ? { Range: `bytes=${receivedBytes}-` } : {}
    const response = await fetchFn(`${BASE}${manifest.file}`, { headers, signal })

    if (receivedBytes && response.status === 200) {
      // The server ignored the range request; start over rather than corrupt.
      await clearPartial(db)
      receivedBytes = 0
      chunkIndex = 0
    } else if (receivedBytes && response.status !== 206) {
      throw new DownloadError(`Download failed (${response.status})`)
    } else if (!receivedBytes && !response.ok) {
      throw new DownloadError(`Download failed (${response.status})`)
    }

    if (!response.body) throw new DownloadError('Download failed (empty response)')

    if (response.headers.get('Content-Encoding')) {
      // The browser would have decoded the bytes, so sizes, hashes and resumes
      // could not line up. Fail clearly instead of with a confusing mismatch.
      throw new DownloadError('The server applied content encoding to the dictionary file')
    }

    onProgress?.({ receivedBytes, totalBytes })

    const reader = response.body.getReader()
    let pending: Uint8Array[] = []
    let pendingBytes = 0

    const flush = async () => {
      if (!pendingBytes) return

      const merged = new Uint8Array(pendingBytes)
      let offset = 0

      for (const part of pending) {
        merged.set(part, offset)
        offset += part.length
      }

      receivedBytes += pendingBytes
      await putChunk(db, manifest.version, chunkIndex++, merged, receivedBytes)
      pending = []
      pendingBytes = 0
    }

    try {
      for (;;) {
        const { done, value } = await reader.read()

        if (done) break

        pending.push(value)
        pendingBytes += value.length
        onProgress?.({ receivedBytes: receivedBytes + pendingBytes, totalBytes })

        if (pendingBytes >= PERSIST_EVERY_BYTES) await flush()
      }
    } finally {
      // Persist what we have, including on abort or network failure, so the
      // next attempt can resume.
      await flush().catch(() => {})
    }
  }

  const stored = await getPartial(db)

  if (!stored || stored.receivedBytes !== totalBytes) {
    throw new DownloadError('Download ended before all data was received')
  }

  const bytes = (await readChunks(db, stored)) as Uint8Array<ArrayBuffer>

  if ((await sha256Hex(bytes)) !== manifest.compressedSha256) {
    await clearPartial(db)
    throw new DownloadError('Downloaded data failed verification; please try again')
  }

  return bytes
}

export const unpack = async (
  compressed: Uint8Array<ArrayBuffer>,
  manifest: Manifest
): Promise<DictionaryFile> => {
  const json = await gunzip(compressed)
  const file = JSON.parse(new TextDecoder().decode(json)) as DictionaryFile

  if (file.format !== manifest.format) {
    throw new DownloadError('Dictionary data does not match its manifest')
  }

  return file
}

/**
 * Full install: download (resumable), verify, unpack, store, and request
 * persistent storage. Replaces any installed dictionary only once everything
 * has succeeded.
 */
export const downloadAndInstall = async (
  db: DictionaryStore,
  manifest: Manifest,
  options: DownloadOptions = {}
): Promise<void> => {
  const compressed = await downloadCompressed(db, manifest, options)
  const file = await unpack(compressed, manifest)

  await installDictionary(db, manifest, file)
  await navigator.storage?.persist?.().catch(() => false)
}
