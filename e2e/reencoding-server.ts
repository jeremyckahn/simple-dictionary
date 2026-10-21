import { readFile } from 'node:fs/promises'
import { createServer, type Server } from 'node:http'
import path from 'node:path'
import { gzipSync } from 'node:zlib'

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.bin': 'application/octet-stream',
}

/**
 * Serves `dist/` the way GitHub Pages and Vercel do: `.bin` files (opaque
 * data, already gzip inside) are compressed again on the fly for any client
 * that accepts gzip, and the browser transparently undoes it. `vite preview`
 * does not do this, so it can't catch bugs that only appear on those hosts.
 */
export const startReencodingServer = async (
  base: string
): Promise<{ server: Server; url: string }> => {
  const dist = path.resolve('dist')
  const server = createServer(async (req, res) => {
    const pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname)

    if (!pathname.startsWith(base)) {
      res.writeHead(404).end()

      return
    }

    const relative = pathname.slice(base.length) || 'index.html'
    const file = path.resolve(dist, relative)

    if (!file.startsWith(dist + path.sep)) {
      res.writeHead(403).end()

      return
    }

    try {
      let body: Uint8Array = await readFile(file)
      const headers: Record<string, string | number> = {
        'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream',
        'Cache-Control': 'no-cache',
      }

      if (file.endsWith('.bin') && /\bgzip\b/.test(String(req.headers['accept-encoding']))) {
        body = gzipSync(body)
        headers['Content-Encoding'] = 'gzip'
        headers.Vary = 'Accept-Encoding'
      }

      headers['Content-Length'] = body.length
      res.writeHead(200, headers).end(body)
    } catch {
      res.writeHead(404).end()
    }
  })

  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))

  const { port } = server.address() as { port: number }

  return { server, url: `http://127.0.0.1:${port}${base}` }
}
