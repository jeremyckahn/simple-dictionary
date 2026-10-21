import { gunzipSync } from 'node:zlib'

const BLOCK = 512

const readString = (block: Uint8Array, start: number, length: number) => {
  let end = start
  while (end < start + length && block[end] !== 0) end++
  return new TextDecoder().decode(block.subarray(start, end))
}

const readOctal = (block: Uint8Array, start: number, length: number) =>
  parseInt(readString(block, start, length).trim() || '0', 8)

/**
 * Minimal tar reader: returns regular files by path. Handles ustar prefixes
 * and GNU long names; skips directories, links and pax headers.
 */
export const readTar = (tar: Uint8Array): Map<string, Uint8Array> => {
  const files = new Map<string, Uint8Array>()
  let offset = 0
  let longName: string | undefined

  while (offset + BLOCK <= tar.length) {
    const header = tar.subarray(offset, offset + BLOCK)
    if (header.every(byte => byte === 0)) break

    const size = readOctal(header, 124, 12)
    const type = String.fromCharCode(header[156] || 48)
    const bodyStart = offset + BLOCK
    const body = tar.subarray(bodyStart, bodyStart + size)
    offset = bodyStart + Math.ceil(size / BLOCK) * BLOCK

    if (type === 'L') {
      longName = readString(body, 0, body.length)
      continue
    }

    const prefix = readString(header, 345, 155)
    const name = longName ?? (prefix ? `${prefix}/` : '') + readString(header, 0, 100)
    longName = undefined

    if (type === '0' || type === '7') {
      files.set(name.replace(/^\.\//, ''), body)
    }
  }

  return files
}

/** Gunzips and reads a `.tar.gz` / `.tgz` into a path -> bytes map. */
export const readTarGz = (archive: Uint8Array): Map<string, Uint8Array> =>
  readTar(gunzipSync(archive))
