import { type DBSchema, type IDBPDatabase, openDB } from 'idb'
import type { DictionaryFile, Entry, Manifest } from './types.ts'

export const DB_NAME = 'simple-dictionary'
const DB_VERSION = 1

/** Entries are stored in blocks to keep the record count (and write time) low. */
export const ENTRIES_PER_BLOCK = 256

export interface PartialDownload {
  version: string
  /** Number of chunk records written so far. */
  chunkCount: number
  receivedBytes: number
}

interface DictionaryDB extends DBSchema {
  /** `installed`: the Manifest of the fully stored dictionary, plus license. */
  meta: {
    key: 'installed' | 'partial' | 'words'
    value: unknown
  }
  /** Entry blocks, keyed by block number. */
  blocks: { key: number; value: Entry[] }
  /** Inflected form -> base headwords. */
  inflections: { key: string; value: string[] }
  /** Raw downloaded chunks awaiting unpacking, keyed `${version}:${index}`. */
  chunks: { key: string; value: Uint8Array }
}

export type DictionaryStore = IDBPDatabase<DictionaryDB>

export interface InstalledInfo {
  manifest: Manifest
  license: string
}

export const openStore = (name = DB_NAME): Promise<DictionaryStore> =>
  openDB<DictionaryDB>(name, DB_VERSION, {
    upgrade(db) {
      db.createObjectStore('meta')
      db.createObjectStore('blocks')
      db.createObjectStore('inflections')
      db.createObjectStore('chunks')
    },
  })

export const getInstalled = async (
  db: DictionaryStore
): Promise<InstalledInfo | undefined> =>
  (await db.get('meta', 'installed')) as InstalledInfo | undefined

export const getWords = async (db: DictionaryStore): Promise<string[]> =>
  ((await db.get('meta', 'words')) as string[] | undefined) ?? []

export const getPartial = async (
  db: DictionaryStore
): Promise<PartialDownload | undefined> =>
  (await db.get('meta', 'partial')) as PartialDownload | undefined

export const putChunk = async (
  db: DictionaryStore,
  version: string,
  index: number,
  data: Uint8Array,
  receivedBytes: number
): Promise<void> => {
  const tx = db.transaction(['chunks', 'meta'], 'readwrite')

  await Promise.all([
    tx.objectStore('chunks').put(data, `${version}:${index}`),
    tx.objectStore('meta').put(
      { version, chunkCount: index + 1, receivedBytes } satisfies PartialDownload,
      'partial'
    ),
    tx.done,
  ])
}

/** Concatenates the stored chunks of a partial download, in order. */
export const readChunks = async (
  db: DictionaryStore,
  partial: PartialDownload
): Promise<Uint8Array> => {
  const out = new Uint8Array(partial.receivedBytes)
  let offset = 0

  for (let i = 0; i < partial.chunkCount; i++) {
    const chunk = await db.get('chunks', `${partial.version}:${i}`)

    if (!chunk) throw new Error(`Missing download chunk ${i}`)

    out.set(chunk, offset)
    offset += chunk.length
  }

  return out
}

export const clearPartial = async (db: DictionaryStore): Promise<void> => {
  const tx = db.transaction(['chunks', 'meta'], 'readwrite')

  await Promise.all([
    tx.objectStore('chunks').clear(),
    tx.objectStore('meta').delete('partial'),
    tx.done,
  ])
}

/**
 * Replaces any installed dictionary with `file` atomically: either the whole
 * new dictionary is committed or the old one stays untouched.
 */
export const installDictionary = async (
  db: DictionaryStore,
  manifest: Manifest,
  file: DictionaryFile
): Promise<void> => {
  const tx = db.transaction(['meta', 'blocks', 'inflections', 'chunks'], 'readwrite')
  const meta = tx.objectStore('meta')
  const blocks = tx.objectStore('blocks')
  const inflections = tx.objectStore('inflections')

  await Promise.all([blocks.clear(), inflections.clear()])

  const writes: Promise<unknown>[] = []

  for (let i = 0; i * ENTRIES_PER_BLOCK < file.entries.length; i++) {
    writes.push(
      blocks.put(file.entries.slice(i * ENTRIES_PER_BLOCK, (i + 1) * ENTRIES_PER_BLOCK), i)
    )
  }

  for (const [form, bases] of Object.entries(file.inflections)) {
    writes.push(inflections.put(bases, form))
  }

  writes.push(
    meta.put(file.words, 'words'),
    meta.put({ manifest, license: file.license } satisfies InstalledInfo, 'installed'),
    meta.delete('partial'),
    tx.objectStore('chunks').clear(),
    tx.done
  )

  await Promise.all(writes)
}

export const getEntry = async (
  db: DictionaryStore,
  index: number
): Promise<Entry | undefined> => {
  const block = await db.get('blocks', Math.floor(index / ENTRIES_PER_BLOCK))

  return block?.[index % ENTRIES_PER_BLOCK]
}

export const getInflection = (
  db: DictionaryStore,
  form: string
): Promise<string[] | undefined> => db.get('inflections', form)

export const deleteDictionary = async (db: DictionaryStore): Promise<void> => {
  const tx = db.transaction(['meta', 'blocks', 'inflections', 'chunks'], 'readwrite')

  await Promise.all([
    tx.objectStore('meta').delete('installed'),
    tx.objectStore('meta').delete('words'),
    tx.objectStore('meta').delete('partial'),
    tx.objectStore('blocks').clear(),
    tx.objectStore('inflections').clear(),
    tx.objectStore('chunks').clear(),
    tx.done,
  ])
}
