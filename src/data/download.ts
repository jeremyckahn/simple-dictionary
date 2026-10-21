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
  type ManifestPart,
  SUPPORTED_FORMAT,
} from './types.ts'

// The app may be served from a sub-path (e.g. GitHub Pages project sites), so
// data URLs are relative to Vite's base rather than the domain root.
const BASE = import.meta.env.BASE_URL

export const MANIFEST_PATH = `${BASE}dictionary-manifest.json`

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

const concat = (parts: Uint8Array[], length: number): Uint8Array<ArrayBuffer> => {
  const out = new Uint8Array(length)
  let offset = 0

  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }

  return out
}

/**
 * Fetches one whole part and checks its size and hash. Plain GETs only: hosts
 * may transparently re-encode responses, which the browser undoes, but that
 * makes byte ranges unusable; whole verified parts are immune to it.
 */
const fetchPart = async (
  part: ManifestPart,
  fetchFn: typeof fetch,
  signal: AbortSignal | undefined,
  onBytes: (received: number) => void
): Promise<Uint8Array<ArrayBuffer>> => {
  const response = await fetchFn(`${BASE}${part.file}`, { signal })

  if (!response.ok) throw new DownloadError(`Download failed (${response.status})`)
  if (!response.body) throw new DownloadError('Download failed (empty response)')

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let received = 0

  for (;;) {
    const { done, value } = await reader.read()

    if (done) break

    chunks.push(value)
    received += value.length
    onBytes(received)
  }

  if (received < part.bytes) {
    throw new DownloadError('Download ended before all data was received')
  }

  const bytes = concat(chunks, received)

  if (received !== part.bytes || (await sha256Hex(bytes)) !== part.sha256) {
    throw new DownloadError('Downloaded data failed verification; please try again')
  }

  return bytes
}

/**
 * Downloads the dictionary described by `manifest` part by part, resuming at
 * the first part a previous attempt did not finish (each finished part is
 * persisted). Aborting via `signal` or a network failure keeps the finished
 * parts; the interrupted part is fetched again whole. Returns the verified
 * compressed bytes.
 */
export const downloadCompressed = async (
  db: DictionaryStore,
  manifest: Manifest,
  { signal, onProgress, fetchFn = fetch }: DownloadOptions = {}
): Promise<Uint8Array<ArrayBuffer>> => {
  const totalBytes = manifest.compressedBytes
  const { parts } = manifest
  let partial = await getPartial(db)

  if (partial && (partial.version !== manifest.version || partial.partCount !== parts.length)) {
    await clearPartial(db)
    partial = undefined
  }

  let receivedBytes = partial?.receivedBytes ?? 0

  onProgress?.({ receivedBytes, totalBytes })

  for (let i = partial?.chunkCount ?? 0; i < parts.length; i++) {
    const base = receivedBytes
    const bytes = await fetchPart(parts[i], fetchFn, signal, received =>
      onProgress?.({ receivedBytes: base + received, totalBytes })
    )

    receivedBytes += bytes.length
    await putChunk(db, manifest.version, i, bytes, receivedBytes, parts.length)
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
