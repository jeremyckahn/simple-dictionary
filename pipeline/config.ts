import { fileURLToPath } from 'node:url'

/**
 * The pinned WordNet source. Changing any of these values means the build
 * consumes different bytes, so `sha256` must be re-derived and reviewed.
 *
 * Princeton's own host (wordnetcode.princeton.edu) was unreachable from the
 * environment this pipeline was written in, so the release is fetched from an
 * immutable npm tarball instead. `wndb-with-exceptions@3.0.2` bundles
 * Princeton's unmodified `WNdb-3.0.tar.gz` (the WordNet 3.0 `dict/` files)
 * and, unlike the other WordNet npm packages, the `*.exc` morphology
 * exception lists that the inflection map is built from. See PIPELINE.md.
 */
export const WORDNET_SOURCE = {
  /** Human-readable WordNet release. */
  version: '3.0',
  url: 'https://registry.npmjs.org/wndb-with-exceptions/-/wndb-with-exceptions-3.0.2.tgz',
  /** SHA-256 of the downloaded file. A mismatch fails the build. */
  sha256: '060cd281dc18395a723ff7dac9a9b1a9356b0da95fc29c363c5b4ec95e7a6a43',
  /** Cache file name (inside the cache directory). */
  fileName: 'wndb-with-exceptions-3.0.2.tgz',
} as const

/** Paths inside the downloaded archive. */
export const ARCHIVE_LAYOUT = {
  /** The npm tarball wraps Princeton's WNdb tarball... */
  innerTarball: 'package/WNdb-3.0.tar.gz',
  /** ...whose `dict/` holds the database files... */
  dictDir: 'dict/',
  /** ...while the npm package ships the exception lists separately. */
  excDir: 'package/data/',
  /** The Princeton license notice shipped with the package. */
  license: 'package/LICENSE',
} as const

export const DICTIONARY_FORMAT_VERSION = 1

export const repoPath = (relative: string): string =>
  fileURLToPath(new URL(`../${relative}`, import.meta.url))
