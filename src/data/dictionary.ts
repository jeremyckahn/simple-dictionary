import {
  type DictionaryStore,
  getEntry,
  getInflection,
  getInstalled,
  getWords,
  type InstalledInfo,
} from './store.ts'
import { indexOfWord, normalizeQuery, prefixSearch } from './search.ts'
import type { Entry } from './types.ts'

export interface LookupResult {
  /** The headword whose entry is returned. */
  word: string
  entry: Entry
  /** Set when the query was an inflected form, e.g. "ran" for word "run". */
  inflectedFrom?: string
}

/**
 * Read access to the installed dictionary. Holds the sorted headword list in
 * memory for instant prefix search; entry bodies are read from IndexedDB.
 */
export class Dictionary {
  readonly info: InstalledInfo
  private readonly db: DictionaryStore
  private readonly words: string[]

  private constructor(db: DictionaryStore, info: InstalledInfo, words: string[]) {
    this.db = db
    this.info = info
    this.words = words
  }

  /** Returns undefined when no dictionary has been installed. */
  static async open(db: DictionaryStore): Promise<Dictionary | undefined> {
    const info = await getInstalled(db)

    if (!info) return undefined

    return new Dictionary(db, info, await getWords(db))
  }

  get wordCount(): number {
    return this.words.length
  }

  suggest(prefix: string, limit = 10): string[] {
    return prefixSearch(this.words, prefix, limit)
  }

  random(): string {
    return this.words[Math.floor(Math.random() * this.words.length)]
  }

  /**
   * Looks up a word, resolving inflected forms ("mice" -> "mouse"). An exact
   * headword always wins over an inflection of something else.
   */
  async lookup(query: string): Promise<LookupResult | undefined> {
    const q = normalizeQuery(query)

    if (!q) return undefined

    const exact = indexOfWord(this.words, q)

    if (exact !== -1) return this.resultAt(exact)

    for (const base of (await getInflection(this.db, q)) ?? []) {
      const i = indexOfWord(this.words, base)

      if (i !== -1) return { ...(await this.resultAt(i)), inflectedFrom: q }
    }

    return undefined
  }

  private async resultAt(index: number): Promise<LookupResult> {
    const entry = await getEntry(this.db, index, this.info.manifest.version)

    if (!entry) throw new Error(`Dictionary is missing entry ${index}`)

    return { word: this.words[index], entry }
  }
}
