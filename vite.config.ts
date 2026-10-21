import { createReadStream, existsSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vitest/config'

/**
 * In `npm run dev` the dictionary files only exist in `dist/` (written by
 * `npm run build:data`), so serve them from there, with Range support like a
 * production static host.
 */
const serveBuiltDictionary = (): Plugin => ({
  name: 'serve-built-dictionary',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      const name = req.url?.split('?')[0].slice(1) ?? ''

      if (!/^dictionary[\w.-]*\.(json|json\.gz)$/.test(name)) return next()

      const file = resolve('dist', name)

      if (!existsSync(file)) {
        res.statusCode = 404
        res.end(`${name} not found; run "npm run build" (or "npm run build:data") first`)

        return
      }

      const size = statSync(file).size
      const range = /^bytes=(\d+)-$/.exec(req.headers.range ?? '')
      const start = range ? Number(range[1]) : 0

      res.statusCode = range ? 206 : 200
      res.setHeader('Accept-Ranges', 'bytes')
      res.setHeader('Content-Type', name.endsWith('.gz') ? 'application/gzip' : 'application/json')
      res.setHeader('Content-Length', size - start)

      if (range) res.setHeader('Content-Range', `bytes ${start}-${size - 1}/${size}`)

      createReadStream(file, { start }).pipe(res)
    })
  },
})

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), serveBuiltDictionary()],
  test: {
    include: ['src/**/*.test.{ts,tsx}', 'pipeline/**/*.test.ts'],
    setupFiles: ['./src/test-setup.ts'],
  },
})
