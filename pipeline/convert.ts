import { generateInflections } from './inflect.ts'
import { DICTIONARY_FORMAT_VERSION } from './config.ts'
import type { DictionaryFile, Entry, Pos, Sense } from './types.ts'
import type { Synset, WordNetDb } from './wordnet.ts'

const POS_ORDER: readonly Pos[] = ['n', 'v', 'a', 'r']

/** Plain code-unit order, which is what the file format documents. */
export const compareCodeUnits = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

const toSense = (synset: Synset, headword: string): Sense => {
  const synonyms: string[] = []
  for (const word of synset.words) {
    if (word.toLowerCase() === headword || synonyms.includes(word)) continue
    synonyms.push(word)
  }
  return [synset.definition, synset.examples, synonyms]
}

/**
 * Builds the dictionary file contents from parsed WordNet.
 *
 * Senses within a part of speech follow WordNet's own sense numbering
 * (most common first); parts of speech are ordered by how many of the word's
 * senses are tagged in the Princeton corpus (ties fall back to n, v, a, r).
 */
export const convert = (db: WordNetDb, wordnetVersion: string): DictionaryFile => {
  const groups = new Map<string, Array<{ pos: Pos; tagged: number; senses: Sense[] }>>()

  for (const indexEntry of db.index) {
    const senses: Sense[] = []
    for (const key of indexEntry.synsets) {
      const synset = db.synsets.get(key)
      if (!synset) throw new Error(`Index entry "${indexEntry.lemma}" points at missing synset ${key}`)
      senses.push(toSense(synset, indexEntry.lemma))
    }
    const list = groups.get(indexEntry.lemma) ?? []
    list.push({ pos: indexEntry.pos, tagged: indexEntry.tagsenseCount, senses })
    groups.set(indexEntry.lemma, list)
  }

  const words = [...groups.keys()].sort(compareCodeUnits)
  const entries: Entry[] = words.map(word =>
    groups
      .get(word)!
      .sort(
        (a, b) => b.tagged - a.tagged || POS_ORDER.indexOf(a.pos) - POS_ORDER.indexOf(b.pos)
      )
      .map(group => [group.pos, group.senses])
  )

  return {
    format: DICTIONARY_FORMAT_VERSION,
    wordnet: wordnetVersion,
    license: db.license,
    words,
    entries,
    inflections: generateInflections(db),
  }
}
