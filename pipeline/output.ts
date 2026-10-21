import { brotliCompressSync, constants, gzipSync } from 'node:zlib'
import { sha256Hex } from './hash.ts'
import type { DictionaryFile } from './types.ts'

/**
 * The compressed data is served as several plain files rather than one. Static
 * hosts (GitHub Pages, Vercel) transparently re-encode downloads for browsers,
 * which makes byte offsets (`Range`) meaningless; separate whole-file requests,
 * each verified by its own hash, work no matter what the host does to them.
 */
export const PART_BYTES = 1024 * 1024

export interface ManifestPart {
  /** File name next to the manifest, e.g. `dictionary.<version>.0.bin`. */
  file: string
  bytes: number
  /** SHA-256 of this part as stored (not as a host may re-encode it). */
  sha256: string
}

export interface Manifest {
  /** Layout version of the data file (see `DictionaryFile.format`). */
  format: number
  wordnet: string
  /** Content version: first 16 hex digits of `sha256`. Changes iff the data does. */
  version: string
  /**
   * The gzipped dictionary, split into consecutive parts. Named `.bin`, not
   * `.gz`: dev servers and hosts map `.gz` to `Content-Encoding: gzip`, so
   * browsers would decode the bytes before the app could verify them.
   */
  parts: ManifestPart[]
  compression: 'gzip'
  /** SHA-256 of the uncompressed JSON the version derives from. */
  sha256: string
  /** SHA-256 of all parts concatenated (the whole gzipped file). */
  compressedSha256: string
  compressedBytes: number
  uncompressedBytes: number
  wordCount: number
  inflectionCount: number
  senseCount: number
}

export interface BuiltOutput {
  /** The whole gzipped file; `parts` are consecutive slices of it. */
  compressed: Uint8Array
  parts: Array<{ fileName: string; bytes: Uint8Array }>
  manifest: Manifest
}

/**
 * Serialises, hashes and compresses the dictionary. The version is derived
 * from the uncompressed JSON so it is independent of zlib implementation
 * details; gzip is used because `DecompressionStream('gzip')` is supported
 * by every current browser.
 */
export const buildOutput = (
  dictionary: DictionaryFile,
  partBytes = PART_BYTES
): BuiltOutput => {
  const json = Buffer.from(JSON.stringify(dictionary), 'utf8')
  const sha256 = sha256Hex(json)
  const version = sha256.slice(0, 16)
  const compressed = new Uint8Array(gzipSync(json, { level: 9 }))
  const parts = Array.from({ length: Math.max(1, Math.ceil(compressed.length / partBytes)) }, (_, i) => ({
    fileName: `dictionary.${version}.${i}.bin`,
    bytes: compressed.subarray(i * partBytes, (i + 1) * partBytes),
  }))

  return {
    compressed,
    parts,
    manifest: {
      format: dictionary.format,
      wordnet: dictionary.wordnet,
      version,
      parts: parts.map(({ fileName, bytes }) => ({
        file: fileName,
        bytes: bytes.length,
        sha256: sha256Hex(bytes),
      })),
      compression: 'gzip',
      sha256,
      compressedSha256: sha256Hex(compressed),
      compressedBytes: compressed.length,
      uncompressedBytes: json.length,
      wordCount: dictionary.words.length,
      inflectionCount: Object.keys(dictionary.inflections).length,
      senseCount: dictionary.entries.reduce(
        (total, entry) => total + entry.reduce((n, [, senses]) => n + senses.length, 0),
        0
      ),
    },
  }
}

/** Brotli size, for reporting only (the shipped file is gzip). */
export const brotliSize = (json: Uint8Array): number =>
  brotliCompressSync(json, {
    params: { [constants.BROTLI_PARAM_QUALITY]: 11, [constants.BROTLI_PARAM_SIZE_HINT]: json.length },
  }).length
