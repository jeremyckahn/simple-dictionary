import { gzipSync } from 'node:zlib'

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
