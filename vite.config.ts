import { createReadStream, existsSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vitest/config'
import { VitePWA } from 'vite-plugin-pwa'

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

      if (!/^dictionary[\w.-]*\.(json|bin)$/.test(name)) return next()

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
      res.setHeader('Content-Type', name.endsWith('.bin') ? 'application/octet-stream' : 'application/json')
      res.setHeader('Content-Length', size - start)

      if (range) res.setHeader('Content-Range', `bytes ${start}-${size - 1}/${size}`)

      createReadStream(file, { start }).pipe(res)
    })
  },
})

// Where the app is served. "/" for Vercel and local use; the GitHub Pages
// workflow sets BASE_PATH to the project sub-path (e.g. "/simple-dictionary/").
const base = process.env.BASE_PATH ?? '/'

// https://vite.dev/config/
export default defineConfig({
  base,
  plugins: [
    react(),
    serveBuiltDictionary(),
    VitePWA({
      // The user decides when to take a new app version (see PwaPrompts).
      registerType: 'prompt',
      pwaAssets: { config: true },
      manifest: {
        name: 'Simple Dictionary',
        short_name: 'Dictionary',
        description: 'A simple, offline English dictionary.',
        theme_color: '#1f5fbf',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: base,
        scope: base,
      },
      workbox: {
        // Only the small app shell is precached. The dictionary lives in
        // IndexedDB after the user opts in to the download, never in the
        // service worker cache.
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        globIgnores: ['**/dictionary*'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  test: {
    include: ['src/**/*.test.{ts,tsx}', 'pipeline/**/*.test.ts'],
    setupFiles: ['./src/test-setup.ts'],
  },
})
