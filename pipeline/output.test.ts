import { gunzipSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { extractSources } from './archive.ts'
import { convert } from './convert.ts'
import { sha256Hex } from './hash.ts'
import { buildOutput } from './output.ts'
import { loadFixtureSources, makeFixtureArchive } from './test-utils.ts'
import { parseWordNet } from './wordnet.ts'

describe('extractSources', () => {
  it('reads the nested archive layout', () => {
    expect(extractSources(makeFixtureArchive())).toEqual(loadFixtureSources())
  })

  it('names the missing piece when the archive has the wrong layout', () => {
    expect(() => extractSources(new Uint8Array(0))).toThrow()
  })
})

describe('buildOutput', () => {
  const dictionary = convert(parseWordNet(extractSources(makeFixtureArchive())), '3.0')
  const output = buildOutput(dictionary)

  it('round-trips through gzip', () => {
    const json = gunzipSync(output.compressed)
    expect(JSON.parse(json.toString('utf8'))).toEqual(dictionary)
  })

  it('names the files after the content hash', () => {
    const json = gunzipSync(output.compressed)
    expect(output.manifest.sha256).toBe(sha256Hex(json))
    expect(output.manifest.version).toBe(output.manifest.sha256.slice(0, 16))
    expect(output.parts.map(p => p.fileName)).toEqual(
      output.parts.map((_, i) => `dictionary.${output.manifest.version}.${i}.bin`)
    )
  })

  it('splits the compressed data into verifiable consecutive parts', () => {
    const split = buildOutput(dictionary, 100)

    expect(split.parts.length).toBeGreaterThan(2)
    expect(split.parts.slice(0, -1).every(p => p.bytes.length === 100)).toBe(true)
    expect(split.manifest.parts).toEqual(
      split.parts.map(p => ({ file: p.fileName, bytes: p.bytes.length, sha256: sha256Hex(p.bytes) }))
    )
    expect(Buffer.concat(split.parts.map(p => p.bytes))).toEqual(Buffer.from(split.compressed))
    expect(split.manifest.compressedSha256).toBe(sha256Hex(split.compressed))
  })

  it('uses a single part for small data', () => {
    expect(output.parts).toHaveLength(1)
  })

  it('reports exact sizes and counts in the manifest', () => {
    expect(output.manifest).toMatchObject({
      compression: 'gzip',
      wordnet: '3.0',
      compressedBytes: output.compressed.length,
      uncompressedBytes: gunzipSync(output.compressed).length,
      compressedSha256: sha256Hex(output.compressed),
      wordCount: 9,
      senseCount: 11,
    })
    expect(output.manifest.inflectionCount).toBe(Object.keys(dictionary.inflections).length)
  })

  it('is deterministic, and the version changes when the content does', () => {
    expect(buildOutput(dictionary).manifest.version).toBe(output.manifest.version)
    const changed = { ...dictionary, wordnet: '3.1' }
    expect(buildOutput(changed).manifest.version).not.toBe(output.manifest.version)
  })
})
