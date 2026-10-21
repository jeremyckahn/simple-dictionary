import { describe, expect, it } from 'vitest'
import { indexOfWord, lowerBound, normalizeQuery, prefixSearch } from './search.ts'

const words = ['a', 'ab', 'abc', 'b', 'ba', 'bar', 'bark', 'c']

describe('lowerBound', () => {
  it('finds insertion points', () => {
    expect(lowerBound(words, '')).toBe(0)
    expect(lowerBound(words, 'ab')).toBe(1)
    expect(lowerBound(words, 'abd')).toBe(3)
    expect(lowerBound(words, 'z')).toBe(words.length)
  })
})

describe('normalizeQuery', () => {
  it('trims, collapses whitespace and lowercases', () => {
    expect(normalizeQuery('  Ice   CREAM ')).toBe('ice cream')
  })
})

describe('indexOfWord', () => {
  it('finds exact matches only', () => {
    expect(indexOfWord(words, 'bar')).toBe(5)
    expect(indexOfWord(words, 'ba ')).toBe(-1)
    expect(indexOfWord(words, 'barn')).toBe(-1)
  })
})

describe('prefixSearch', () => {
  it('returns words with the prefix in order', () => {
    expect(prefixSearch(words, 'ba')).toEqual(['ba', 'bar', 'bark'])
  })

  it('is case-insensitive', () => {
    expect(prefixSearch(words, 'BAR')).toEqual(['bar', 'bark'])
  })

  it('respects the limit', () => {
    expect(prefixSearch(words, 'a', 2)).toEqual(['a', 'ab'])
  })

  it('returns nothing for an empty or unmatched prefix', () => {
    expect(prefixSearch(words, '')).toEqual([])
    expect(prefixSearch(words, '   ')).toEqual([])
    expect(prefixSearch(words, 'zz')).toEqual([])
  })
})
