/**
 * Shape of the generated dictionary file (before gzip). Everything is plain
 * JSON; `entries` is parallel to `words`, so `entries[i]` is the body of
 * `words[i]` and a word is looked up by binary search over `words`.
 */

/** Part of speech: noun, verb, adjective (incl. satellites), adverb. */
export type Pos = 'n' | 'v' | 'a' | 'r'

/** `[definition, examples, synonyms]`; both lists may be empty. */
export type Sense = [definition: string, examples: string[], synonyms: string[]]

/**
 * One headword's body: a group per part of speech (commonest first), each
 * with its senses (commonest first). Sense numbers are array index + 1.
 */
export type Entry = Array<[pos: Pos, senses: Sense[]]>

export interface DictionaryFile {
  /** Bumped when the layout below changes incompatibly. */
  format: number
  /** Source WordNet release, e.g. "3.0". */
  wordnet: string
  /** The WordNet license notice, which must accompany every copy of the data. */
  license: string
  /**
   * Lowercase headwords (multi-word phrases use spaces), sorted ascending by
   * UTF-16 code unit order (the default `Array.prototype.sort` / `<` order),
   * so both exact and prefix lookups can binary search.
   */
  words: string[]
  entries: Entry[]
  /**
   * Inflected form -> base headwords it may come from, most likely first
   * (irregular forms from WordNet's exception lists ahead of suffix rules).
   * Every base is present in `words`. Keys are lowercase.
   */
  inflections: Record<string, string[]>
}
