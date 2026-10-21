import { describe, expect, it } from 'vitest'
import { convert } from './convert.ts'
import { loadFixtureSources } from './test-utils.ts'
import { parseWordNet } from './wordnet.ts'

const dictionary = convert(parseWordNet(loadFixtureSources()), '3.0')
const entry = (word: string) => dictionary.entries[dictionary.words.indexOf(word)]

describe('convert', () => {
  it('lists unique lowercase headwords in sorted order, with parallel entries', () => {
    expect(dictionary.words).toEqual([
      'city of light',
      'computer mouse',
      'felicitous',
      'good',
      'happy',
      'mouse',
      'paris',
      'run',
      'well',
    ])
    expect(dictionary.entries).toHaveLength(dictionary.words.length)
  })

  it('numbers senses in the index order, not file order', () => {
    const noun = entry('mouse').find(([pos]) => pos === 'n')!
    expect(noun[1].map(sense => sense[0])).toEqual([
      'a hand-operated device; it moves a cursor',
      'any of numerous small rodents; typically resembling rats',
    ])
  })

  it('orders parts of speech by tagged-sense count', () => {
    expect(entry('mouse').map(([pos]) => pos)).toEqual(['v', 'n'])
  })

  it('includes examples, and synonyms without the headword itself', () => {
    const [, senses] = entry('mouse').find(([pos]) => pos === 'n')!
    expect(senses[0]).toEqual([
      'a hand-operated device; it moves a cursor',
      ['he clicked the mouse', 'double-click the mouse'],
      ['computer mouse'],
    ])
    expect(senses[1][2]).toEqual([])
  })

  it('keeps the original casing of synonyms and excludes the headword case-insensitively', () => {
    expect(entry('paris')[0][1][0][2]).toEqual(['City of Light'])
    expect(entry('city of light')[0][1][0][2]).toEqual(['Paris'])
  })

  it('treats satellite adjectives as adjectives', () => {
    expect(entry('happy')).toEqual([
      ['a', [['marked by good fortune', ['a happy outcome'], ['felicitous']]]],
    ])
  })

  it('includes only the requested data: no relations, one sense list per part of speech', () => {
    for (const parts of dictionary.entries) {
      for (const [, senses] of parts) {
        for (const sense of senses) expect(sense).toHaveLength(3)
      }
    }
  })

  it('fails loudly if an index entry points at a missing synset', () => {
    const sources = loadFixtureSources()
    sources.index.n += 'ghost n 1 0 1 0 99999999  \n'
    expect(() => convert(parseWordNet(sources), '3.0')).toThrow(/missing synset/)
  })
})
