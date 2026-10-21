import { ARCHIVE_LAYOUT } from './config.ts'
import { readTarGz } from './tar.ts'
import type { Pos } from './types.ts'
import { POS_LIST, type WordNetSources } from './wordnet.ts'

const FILE_SUFFIX: Record<Pos, string> = { n: 'noun', v: 'verb', a: 'adj', r: 'adv' }

const decode = (files: Map<string, Uint8Array>, name: string): string => {
  const bytes = files.get(name)
  if (!bytes) throw new Error(`Expected ${name} in the WordNet archive`)
  return new TextDecoder().decode(bytes)
}

/** Unpacks the pinned archive's nested layout into WordNet source texts. */
export const extractSources = (archive: Uint8Array): WordNetSources => {
  const outer = readTarGz(archive)
  const innerBytes = outer.get(ARCHIVE_LAYOUT.innerTarball)
  if (!innerBytes) throw new Error(`Expected ${ARCHIVE_LAYOUT.innerTarball} in the archive`)
  const inner = readTarGz(innerBytes)

  const sources = { data: {}, index: {}, exc: {}, license: decode(outer, ARCHIVE_LAYOUT.license) } as WordNetSources
  for (const pos of POS_LIST) {
    const suffix = FILE_SUFFIX[pos]
    sources.data[pos] = decode(inner, `${ARCHIVE_LAYOUT.dictDir}data.${suffix}`)
    sources.index[pos] = decode(inner, `${ARCHIVE_LAYOUT.dictDir}index.${suffix}`)
    sources.exc[pos] = decode(outer, `${ARCHIVE_LAYOUT.excDir}${suffix}.exc`)
  }
  return sources
}
