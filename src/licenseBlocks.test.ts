import { describe, expect, it } from 'vitest'
import raw from '../THIRD_PARTY_LICENSES?raw'
import { toLicenseBlocks } from './licenseBlocks.ts'

describe('toLicenseBlocks', () => {
  it('reflows hard-wrapped paragraphs and drops trailing whitespace', () => {
    expect(toLicenseBlocks('one two  \nthree\n  \nfour\n')).toEqual([
      { kind: 'text', text: 'one two three' },
      { kind: 'text', text: 'four' },
    ])
  })

  it('treats === as a title underline and --- as a rule', () => {
    expect(toLicenseBlocks('Title\n=====\n\nbody\n\n------\nName\n------\n\nmore')).toEqual([
      { kind: 'heading', text: 'Title' },
      { kind: 'text', text: 'body' },
      { kind: 'rule' },
      { kind: 'text', text: 'Name' },
      { kind: 'rule' },
      { kind: 'text', text: 'more' },
    ])
  })

  it('heals an all-caps word split by a hyphen but keeps real hyphens', () => {
    expect(toLicenseBlocks('OF MERCHANT-\nABILITY OR GPL-2.0-\nonly')).toEqual([
      { kind: 'text', text: 'OF MERCHANTABILITY OR GPL-2.0- only' },
    ])
  })

  it('keeps every word of the real license text', () => {
    const words = (s: string) =>
      s
        .replace(/[-=]{3,}/g, ' ')
        .split(/\s+/)
        .filter(Boolean)
        .join(' ')
    const rebuilt = toLicenseBlocks(raw)
      .map(b => ('text' in b ? b.text : ''))
      .join(' ')

    // Same words in the same order, apart from the healed MERCHANT-ABILITY.
    expect(words(rebuilt)).toBe(words(raw).replace('MERCHANT- ABILITY', 'MERCHANTABILITY'))
  })
})
