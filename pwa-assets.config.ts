import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// Generates the 64/192/512 PNGs, the maskable 512 icon, the Apple touch icon
// and favicon.ico from the single SVG source.
export default defineConfig({
  preset: {
    ...minimal2023Preset,
    maskable: { sizes: [512], padding: 0.2, resizeOptions: { background: '#8a3a2f' } },
    apple: { sizes: [180], padding: 0.2, resizeOptions: { background: '#8a3a2f' } },
  },
  images: ['public/icon.svg'],
})
