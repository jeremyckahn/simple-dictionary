import { createHash } from 'node:crypto'

export class HashMismatchError extends Error {
  readonly label: string
  readonly expected: string
  readonly actual: string

  constructor(label: string, expected: string, actual: string) {
    super(
      `SHA-256 mismatch for ${label}: expected ${expected}, got ${actual}. ` +
        'Refusing to continue; if the pinned source was changed on purpose, ' +
        'review it and update the hash in pipeline/config.ts.'
    )
    this.name = 'HashMismatchError'
    this.label = label
    this.expected = expected
    this.actual = actual
  }
}

export const sha256Hex = (data: Uint8Array | string): string =>
  createHash('sha256').update(data).digest('hex')

/** Throws `HashMismatchError` unless `data` hashes to `expected`. */
export const verifySha256 = (
  data: Uint8Array,
  expected: string,
  label: string
): void => {
  const actual = sha256Hex(data)
  if (actual !== expected.toLowerCase()) {
    throw new HashMismatchError(label, expected.toLowerCase(), actual)
  }
}
