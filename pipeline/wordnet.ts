import type { Pos } from './types.ts'

export const POS_LIST: readonly Pos[] = ['n', 'v', 'a', 'r']

export interface Synset {
  /** Cased lemmas as written in WordNet, spaces instead of underscores. */
  words: string[]
  definition: string
  examples: string[]
}

export interface IndexEntry {
  /** Lowercase lemma, spaces instead of underscores. */
  lemma: string
  pos: Pos
  /** Number of senses that appear in WordNet's semantic concordance. */
  tagsenseCount: number
  /** Synset keys in sense-number order, i.e. commonest sense first. */
  synsets: string[]
}

export interface WordNetSources {
  /** Contents of data.noun etc. */
  data: Record<Pos, string>
  /** Contents of index.noun etc. */
  index: Record<Pos, string>
  /** Contents of noun.exc etc. */
  exc: Record<Pos, string>
}

export interface WordNetDb {
  synsets: Map<string, Synset>
  index: IndexEntry[]
  /** Exception list lines as `[inflected, bases]`, normalised. */
  exceptions: Record<Pos, Array<[string, string[]]>>
}

const synsetKey = (pos: Pos, offset: string) => `${pos}${offset}`

/** WordNet writes lemmas with underscores for spaces. */
const humanise = (lemma: string) => lemma.replaceAll('_', ' ')

/** Adjective lemmas in data files carry a syntactic marker: `good(a)`. */
const stripMarker = (word: string) => word.replace(/\((?:a|p|ip)\)$/, '')

/**
 * Splits a gloss into its definition and quoted example sentences.
 *
 * Glosses look like `definition; "example one"; "example two"`. A definition
 * can contain semicolons of its own, but an example always follows a
 * semicolon directly before an opening quote, so the first such occurrence
 * ends the definition.
 */
export const parseGloss = (gloss: string): { definition: string; examples: string[] } => {
  const text = gloss.trim()
  const firstExample = text.search(/;\s*"/)
  if (firstExample === -1) return { definition: text, examples: [] }

  const examples = [...text.slice(firstExample).matchAll(/"([^"]+)"/g)].map(match =>
    match[1].trim()
  )
  return { definition: text.slice(0, firstExample).trim(), examples }
}

/** Parses one `data.*` file into synsets keyed by part of speech + offset. */
export const parseData = (text: string, into = new Map<string, Synset>()) => {
  for (const line of text.split('\n')) {
    // The license header is indented; real records start with the offset.
    if (!line || line.startsWith(' ')) continue

    const bar = line.indexOf('|')
    const fields = line.slice(0, bar).trim().split(' ')
    const [offset, , ssType, wordCount] = fields
    // Adjective satellites (`s`) share data.adj and are adjectives for us.
    const pos = (ssType === 's' ? 'a' : ssType) as Pos

    const words: string[] = []
    for (let i = 0; i < parseInt(wordCount, 16); i++) {
      words.push(humanise(stripMarker(fields[4 + i * 2])))
    }

    const { definition, examples } = parseGloss(line.slice(bar + 1))
    into.set(synsetKey(pos, offset), { words, definition, examples })
  }
  return into
}

/** Parses one `index.*` file. */
export const parseIndex = (text: string): IndexEntry[] => {
  const entries: IndexEntry[] = []
  for (const line of text.split('\n')) {
    if (!line || line.startsWith(' ')) continue

    // lemma pos synset_cnt p_cnt [ptr_symbol...] sense_cnt tagsense_cnt offset...
    const fields = line.trim().split(' ')
    const [lemma, pos, synsetCount] = fields
    const offsets = fields.slice(fields.length - parseInt(synsetCount, 10))
    entries.push({
      lemma: humanise(lemma).toLowerCase(),
      pos: pos as Pos,
      tagsenseCount: parseInt(fields[fields.length - offsets.length - 1], 10),
      synsets: offsets.map(offset => synsetKey(pos as Pos, offset)),
    })
  }
  return entries
}

/** Parses one `*.exc` file: `inflected base [base...]` per line. */
export const parseExceptions = (text: string): Array<[string, string[]]> =>
  text
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const [inflected, ...bases] = line.split(/\s+/).map(word => humanise(word).toLowerCase())
      return [inflected, bases]
    })

export const parseWordNet = (sources: WordNetSources): WordNetDb => {
  const synsets = new Map<string, Synset>()
  const index: IndexEntry[] = []
  const exceptions = {} as WordNetDb['exceptions']
  for (const pos of POS_LIST) {
    parseData(sources.data[pos], synsets)
    index.push(...parseIndex(sources.index[pos]))
    exceptions[pos] = parseExceptions(sources.exc[pos])
  }
  return { synsets, index, exceptions }
}
