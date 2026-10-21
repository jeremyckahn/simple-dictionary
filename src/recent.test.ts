// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { addRecent, clearRecent, loadRecent, MAX_RECENT, removeRecent } from './recent.ts'

beforeEach(() => localStorage.clear())

describe('recent searches', () => {
  it('starts empty', () => {
    expect(loadRecent()).toEqual([])
  })

  it('puts the newest first and deduplicates', () => {
    addRecent('a')
    addRecent('b')

    expect(addRecent('a')).toEqual(['a', 'b'])
    expect(loadRecent()).toEqual(['a', 'b'])
  })

  it('caps the list', () => {
    for (let i = 0; i < MAX_RECENT + 5; i++) addRecent(`w${i}`)

    expect(loadRecent()).toHaveLength(MAX_RECENT)
    expect(loadRecent()[0]).toBe(`w${MAX_RECENT + 4}`)
  })

  it('ignores corrupt storage', () => {
    localStorage.setItem('recent-searches', '{nope')
    expect(loadRecent()).toEqual([])

    localStorage.setItem('recent-searches', '[1,"ok"]')
    expect(loadRecent()).toEqual(['ok'])
  })

  it('removes one word, keeping the order of the rest', () => {
    addRecent('a')
    addRecent('b')
    addRecent('c')

    expect(removeRecent('b')).toEqual(['c', 'a'])
    expect(loadRecent()).toEqual(['c', 'a'])
  })

  it('ignores removing a word that is not in the history', () => {
    addRecent('a')

    expect(removeRecent('zzz')).toEqual(['a'])
  })

  it('clears', () => {
    addRecent('a')
    clearRecent()

    expect(loadRecent()).toEqual([])
  })
})
