import { brotliCompressSync, constants, gzipSync } from 'node:zlib'
import { sha256Hex } from './hash.ts'
import type { DictionaryFile } from './types.ts'

export interface Manifest {
  /** Layout version of the data file (see `DictionaryFile.format`). */
  format: number
  wordnet: string
  /** Content version: first 16 hex digits of `sha256`. Changes iff the data does. */
  version: string
  /** File name next to the manifest, e.g. `dictionary.<version>.bin`.
   * Deliberately not `.gz`: static hosts and dev servers map `.gz` to
   * `Content-Encoding: gzip`, which makes browsers decode the bytes before the
   * app can verify, count or resume them. */
  file: string
  compression: 'gzip'
  /** SHA-256 of the uncompressed JSON the version derives from. */
  sha256: string
  /** SHA-256 of the gzipped file as served. */
  compressedSha256: string
  compressedBytes: number
  uncompressedBytes: number
  wordCount: number
  inflectionCount: number
  senseCount: number
}

export interface BuiltOutput {
  fileName: string
  compressed: Uint8Array
  manifest: Manifest
}

/**
 * Serialises, hashes and compresses the dictionary. The version is derived
 * from the uncompressed JSON so it is independent of zlib implementation
 * details; gzip is used because `DecompressionStream('gzip')` is supported
 * by every current browser.
 */
export const buildOutput = (dictionary: DictionaryFile): BuiltOutput => {
  const json = Buffer.from(JSON.stringify(dictionary), 'utf8')
  const sha256 = sha256Hex(json)
  const version = sha256.slice(0, 16)
  const compressed = new Uint8Array(gzipSync(json, { level: 9 }))
  const fileName = `dictionary.${version}.bin`

  return {
    fileName,
    compressed,
    manifest: {
      format: dictionary.format,
      wordnet: dictionary.wordnet,
      version,
      file: fileName,
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
