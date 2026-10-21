import { sha256Hex } from './download.ts'
import type { DictionaryFile, Manifest } from './types.ts'

export const fixtureFile = (): DictionaryFile => ({
  format: 1,
  wordnet: 'test',
  license: 'test license',
  words: ['apple', 'apply', 'apt', 'mouse', 'run', 'saw', 'see'],
  entries: [
    [['n', [['a fruit', ['an apple a day'], []]]]],
    [['v', [['to put to use', [], ['employ']]]]],
    [['a', [['inclined', [], []]]]],
    [['n', [['a rodent', [], []]]]],
    [['v', [['move fast', ['run home'], ['sprint']]]]],
    [['n', [['a tool', [], []]]]],
    [['v', [['perceive', [], []]]]],
  ],
  inflections: { ran: ['run'], mice: ['mouse'], saw: ['see'], running: ['run'] },
})

const gzip = async (data: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> =>
  new Uint8Array(
    await new Response(
      new Blob([data]).stream().pipeThrough(new CompressionStream('gzip'))
    ).arrayBuffer()
  )

/** Small, so the tiny fixture file still splits into several parts. */
export const FIXTURE_PART_BYTES = 100

/** Builds the compressed parts and manifest the way the pipeline would. */
const buildFixture = async (): Promise<{
  manifest: Manifest
  parts: Array<Uint8Array<ArrayBuffer>>
}> => {
  const json = new TextEncoder().encode(JSON.stringify(fixtureFile()))
  const compressed = await gzip(json)
  const sha256 = await sha256Hex(json)
  const version = sha256.slice(0, 16)
  const parts = Array.from({ length: Math.ceil(compressed.length / FIXTURE_PART_BYTES) }, (_, i) =>
    compressed.slice(i * FIXTURE_PART_BYTES, (i + 1) * FIXTURE_PART_BYTES)
  )

  return {
    parts,
    manifest: {
      format: 1,
      wordnet: 'test',
      version,
      parts: await Promise.all(
        parts.map(async (bytes, i) => ({
          file: `dictionary.${version}.${i}.bin`,
          bytes: bytes.length,
          sha256: await sha256Hex(bytes),
        }))
      ),
      compression: 'gzip',
      sha256,
      compressedSha256: await sha256Hex(compressed),
      compressedBytes: compressed.length,
      uncompressedBytes: json.length,
      wordCount: 7,
      inflectionCount: 4,
      senseCount: 7,
    },
  }
}

export interface Served {
  manifest: Manifest
  fetchFn: typeof fetch
  /** File names requested (parts only, not the manifest), in order. */
  requests: string[]
}

/**
 * A fake origin serving the fixture's parts. `failPart` makes the first
 * request for that part die mid-stream; `corrupt` flips a bit in every part;
 * `contentEncoding` adds a `Content-Encoding` header (browsers undo these
 * transparently, so the bytes the app sees are unchanged).
 */
export const serveFixture = async (
  options: {
    failPart?: { index: number; afterBytes: number }
    corrupt?: boolean
    contentEncoding?: boolean
  } = {}
): Promise<Served> => {
  const { manifest, parts } = await buildFixture()
  const requests: string[] = []
  let failed = false

  const fetchFn = (async (input: RequestInfo | URL) => {
    const url = String(input)

    if (url.endsWith('dictionary-manifest.json')) return Response.json(manifest)

    const file = url.slice(url.lastIndexOf('/') + 1)
    const index = manifest.parts.findIndex(p => p.file === file)

    if (index === -1) return new Response('not found', { status: 404 })

    requests.push(file)

    let body = options.corrupt ? parts[index].map(b => b ^ 1) : parts[index]
    let failMidway = false

    if (options.failPart?.index === index && !failed) {
      failed = true
      failMidway = true
      body = body.slice(0, options.failPart.afterBytes)
    }

    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.enqueue(body.slice(0, 16))
        body = body.slice(16)

        if (!body.length) {
          if (failMidway) controller.error(new TypeError('network error'))
          else controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: options.contentEncoding ? { 'Content-Encoding': 'gzip' } : {},
    })
  }) as typeof fetch

  return { manifest, fetchFn, requests }
}

let dbCounter = 0

export const freshDbName = (): string => `test-db-${dbCounter++}`
