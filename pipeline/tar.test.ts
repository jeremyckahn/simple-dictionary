import { describe, expect, it } from 'vitest'
import { readTar, readTarGz } from './tar.ts'
import { makeTar, makeTarGz } from './test-utils.ts'

const text = (bytes: Uint8Array | undefined) => new TextDecoder().decode(bytes)

describe('readTar', () => {
  it('returns file contents by path, including sizes that are not block-aligned', () => {
    const big = 'x'.repeat(1300)
    const files = readTar(makeTar({ 'dict/a.txt': 'hello', 'dict/b.txt': big }))
    expect([...files.keys()]).toEqual(['dict/a.txt', 'dict/b.txt'])
    expect(text(files.get('dict/a.txt'))).toBe('hello')
    expect(text(files.get('dict/b.txt'))).toBe(big)
  })

  it('reads gzipped archives', () => {
    const files = readTarGz(makeTarGz({ 'package/x': 'y' }))
    expect(text(files.get('package/x'))).toBe('y')
  })

  it('handles an empty archive', () => {
    expect(readTar(makeTar({})).size).toBe(0)
  })
})
