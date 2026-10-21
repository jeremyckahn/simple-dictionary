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

/** Builds the compressed file and manifest the way the pipeline would. */
const buildFixture = async (): Promise<{ manifest: Manifest; compressed: Uint8Array<ArrayBuffer> }> => {
  const json = new TextEncoder().encode(JSON.stringify(fixtureFile()))
  const compressed = await gzip(json)
  const sha256 = await sha256Hex(json)

  return {
    compressed,
    manifest: {
      format: 1,
      wordnet: 'test',
      version: sha256.slice(0, 16),
      file: `dictionary.${sha256.slice(0, 16)}.json.gz`,
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
  /** Requests made, as `[url, Range header]`. */
  requests: Array<[string, string | undefined]>
}

/**
 * A fake origin serving the fixture's file. `failAfterBytes` makes the first
 * response die mid-stream; `ignoreRange` makes the server answer 200 always.
 */
export const serveFixture = async (
  options: { failAfterBytes?: number; ignoreRange?: boolean; corrupt?: boolean } = {}
): Promise<Served> => {
  const { manifest, compressed } = await buildFixture()
  const data = options.corrupt ? compressed.map(b => b ^ 1) : compressed
  const requests: Served['requests'] = []
  let failed = false

  const fetchFn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const range = (init?.headers as Record<string, string> | undefined)?.Range

    requests.push([url, range])

    if (url.endsWith('dictionary-manifest.json')) return Response.json(manifest)

    const start = range && !options.ignoreRange ? Number(/bytes=(\d+)-/.exec(range)![1]) : 0
    let body = data.slice(start)
    let failMidway = false

    if (options.failAfterBytes !== undefined && !failed) {
      failed = true
      failMidway = true
      body = body.slice(0, options.failAfterBytes)
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

    return new Response(stream, { status: start ? 206 : 200 })
  }) as typeof fetch

  return { manifest, fetchFn, requests }
}

let dbCounter = 0

export const freshDbName = (): string => `test-db-${dbCounter++}`
