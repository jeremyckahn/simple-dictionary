// The data file layout is defined by the build pipeline; re-exported here so
// the app has one import site. These are type-only, so no Node code is bundled.
export type {
  DictionaryFile,
  Entry,
  Pos,
  Sense,
} from '../../pipeline/types.ts'

/** Mirrors `Manifest` in pipeline/output.ts (the JSON the build emits). */
export interface ManifestPart {
  file: string
  bytes: number
  sha256: string
}

export interface Manifest {
  format: number
  wordnet: string
  version: string
  parts: ManifestPart[]
  compression: 'gzip'
  sha256: string
  compressedSha256: string
  compressedBytes: number
  uncompressedBytes: number
  wordCount: number
  inflectionCount: number
  senseCount: number
}

/** The data layout this build of the app understands. */
export const SUPPORTED_FORMAT = 1

export interface DownloadProgress {
  receivedBytes: number
  totalBytes: number
}
