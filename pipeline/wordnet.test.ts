import { describe, expect, it } from 'vitest'
import { loadFixtureSources } from './test-utils.ts'
import {
  parseData,
  parseExceptions,
  parseGloss,
  parseIndex,
  parseWordNet,
} from './wordnet.ts'

describe('parseGloss', () => {
  it('splits a definition from its quoted examples', () => {
    expect(parseGloss('a small rodent; "the mouse ran"; "a house mouse"  ')).toEqual({
      definition: 'a small rodent',
      examples: ['the mouse ran', 'a house mouse'],
    })
  })

  it('keeps semicolons that belong to the definition', () => {
    expect(parseGloss('a device; it moves a cursor; "click the mouse"')).toEqual({
      definition: 'a device; it moves a cursor',
      examples: ['click the mouse'],
    })
  })

  it('accepts an example with no space after the semicolon', () => {
    expect(parseGloss('strong and sharp;"the pungent taste"')).toEqual({
      definition: 'strong and sharp',
      examples: ['the pungent taste'],
    })
  })

  it('handles glosses without examples and semicolons inside examples', () => {
    expect(parseGloss('to go stealthily  ')).toEqual({ definition: 'to go stealthily', examples: [] })
    expect(parseGloss('stern; "she was firm; he gave in"').examples).toEqual([
      'she was firm; he gave in',
    ])
  })
})

describe('parseData', () => {
  const synsets = parseData(loadFixtureSources().data.n)

  it('skips the indented license header', () => {
    expect(synsets.size).toBe(4)
  })

  it('reads lemmas, turning underscores into spaces and keeping case', () => {
    expect(synsets.get('n00000300')?.words).toEqual(['Paris', 'City of Light'])
  })

  it('reads definition and examples', () => {
    expect(synsets.get('n00000200')).toMatchObject({
      definition: 'a hand-operated device; it moves a cursor',
      examples: ['he clicked the mouse', 'double-click the mouse'],
    })
  })

  it('strips adjective markers and files satellites under adjectives', () => {
    const adjectives = parseData(loadFixtureSources().data.a)
    expect(adjectives.get('a00000700')?.words).toEqual(['good'])
    expect(adjectives.get('a00000800')?.words).toEqual(['felicitous', 'happy'])
  })
})

describe('parseIndex', () => {
  it('reads lemma, tagged-sense count and synsets in sense order', () => {
    const [mouse] = parseIndex(loadFixtureSources().index.n)
    expect(mouse).toEqual({
      lemma: 'mouse',
      pos: 'n',
      tagsenseCount: 1,
      synsets: ['n00000200', 'n00000100'],
    })
  })

  it('lowercases and de-underscores lemmas', () => {
    const lemmas = parseIndex(loadFixtureSources().index.n).map(entry => entry.lemma)
    expect(lemmas).toContain('city of light')
  })
})

describe('parseExceptions', () => {
  it('reads inflected forms with one or more bases', () => {
    expect(parseExceptions('mice mouse\nbetter good well\n\n')).toEqual([
      ['mice', ['mouse']],
      ['better', ['good', 'well']],
    ])
  })
})

describe('parseWordNet', () => {
  it('combines all parts of speech', () => {
    const db = parseWordNet(loadFixtureSources())
    expect(db.synsets.size).toBe(9)
    expect(db.exceptions.v).toHaveLength(3)
  })
})
