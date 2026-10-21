import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { extractSources } from './archive.ts'
import { WORDNET_SOURCE, repoPath } from './config.ts'
import { convert } from './convert.ts'
import { fetchPinned } from './download.ts'
import { brotliSize, buildOutput } from './output.ts'
import { parseWordNet } from './wordnet.ts'

const main = async () => {
  const outDir = path.resolve(process.argv[2] ?? repoPath('dist'))
  const cacheDir = repoPath('.cache')
  const log = (message: string) => console.log(`[build:data] ${message}`)

  const archive = await fetchPinned(WORDNET_SOURCE, cacheDir, { log })
  log('Parsing WordNet')
  const dictionary = convert(parseWordNet(extractSources(archive)), WORDNET_SOURCE.version)

  const { fileName, compressed, manifest } = buildOutput(dictionary)
  await mkdir(outDir, { recursive: true })
  await writeFile(path.join(outDir, fileName), compressed)
  await writeFile(
    path.join(outDir, 'dictionary-manifest.json'),
    JSON.stringify(manifest, null, 2) + '\n'
  )

  const mb = (bytes: number) => (bytes / 1024 / 1024).toFixed(2)
  log(`Wrote ${path.join(outDir, fileName)}`)
  log(
    `${manifest.wordCount} words, ${manifest.senseCount} senses, ` +
      `${manifest.inflectionCount} inflected forms`
  )
  log(
    `${manifest.uncompressedBytes} B uncompressed (${mb(manifest.uncompressedBytes)} MiB), ` +
      `${manifest.compressedBytes} B gzipped (${mb(manifest.compressedBytes)} MiB)`
  )
  if (process.env.REPORT_BROTLI) {
    log(`brotli would be ${brotliSize(Buffer.from(JSON.stringify(dictionary)))} B`)
  }
}

main().catch(error => {
  console.error(`[build:data] FAILED: ${error instanceof Error ? error.message : error}`)
  process.exit(1)
})
