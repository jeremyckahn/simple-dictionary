import { describe, expect, it } from 'vitest'
import { HashMismatchError, sha256Hex, verifySha256 } from './hash.ts'

const bytes = (text: string) => new TextEncoder().encode(text)

describe('sha256', () => {
  it('computes known digests', () => {
    expect(sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
    )
  })

  it('accepts matching content, case-insensitively', () => {
    const expected = sha256Hex('abc').toUpperCase()
    expect(() => verifySha256(bytes('abc'), expected, 'fixture')).not.toThrow()
  })

  it('throws HashMismatchError naming both digests on mismatch', () => {
    const expected = sha256Hex('abc')
    const attempt = () => verifySha256(bytes('abd'), expected, 'fixture')
    expect(attempt).toThrow(HashMismatchError)
    expect(attempt).toThrow(expected)
    expect(attempt).toThrow(sha256Hex('abd'))
  })
})
