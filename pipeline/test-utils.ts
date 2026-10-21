import { readFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { POS_LIST, type WordNetSources } from './wordnet.ts'

const BLOCK = 512

const writeField = (block: Uint8Array, value: string, start: number, length: number) =>
  block.set(new TextEncoder().encode(value).subarray(0, length), start)

/** Builds a ustar archive; test-only. */
export const makeTar = (files: Record<string, string | Uint8Array>): Uint8Array => {
  const chunks: Uint8Array[] = []
  for (const [name, content] of Object.entries(files)) {
    const body = typeof content === 'string' ? new TextEncoder().encode(content) : content
    const header = new Uint8Array(BLOCK)
    writeField(header, name, 0, 100)
    writeField(header, '0000644\0', 100, 8)
    writeField(header, body.length.toString(8).padStart(11, '0') + '\0', 124, 12)
    header[156] = '0'.charCodeAt(0)
    writeField(header, 'ustar\0' + '00', 257, 8)
    chunks.push(header, body, new Uint8Array((BLOCK - (body.length % BLOCK)) % BLOCK))
  }
  chunks.push(new Uint8Array(BLOCK * 2))
  const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0))
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.length
  }
  return out
}

export const makeTarGz = (files: Record<string, string | Uint8Array>) =>
  new Uint8Array(gzipSync(makeTar(files)))

const FIXTURE_DIR = new URL('./__fixtures__/dict/', import.meta.url)
const SUFFIXES = { n: 'noun', v: 'verb', a: 'adj', r: 'adv' } as const

const fixture = (name: string) => readFileSync(new URL(name, FIXTURE_DIR), 'utf8')

/** The tiny WordNet-format fixture as parsed-ready source texts. */
export const loadFixtureSources = (): WordNetSources => {
  const sources = { data: {}, index: {}, exc: {} } as WordNetSources
  for (const pos of POS_LIST) {
    sources.data[pos] = fixture(`data.${SUFFIXES[pos]}`)
    sources.index[pos] = fixture(`index.${SUFFIXES[pos]}`)
    sources.exc[pos] = fixture(`${SUFFIXES[pos]}.exc`)
  }
  return sources
}

/** The fixture packed into the same nested layout as the pinned archive. */
export const makeFixtureArchive = (): Uint8Array => {
  const dict: Record<string, string> = {}
  const exc: Record<string, string> = {}
  for (const suffix of Object.values(SUFFIXES)) {
    dict[`dict/data.${suffix}`] = fixture(`data.${suffix}`)
    dict[`dict/index.${suffix}`] = fixture(`index.${suffix}`)
    exc[`package/data/${suffix}.exc`] = fixture(`${suffix}.exc`)
  }
  return makeTarGz({ 'package/WNdb-3.0.tar.gz': makeTarGz(dict), ...exc })
}
