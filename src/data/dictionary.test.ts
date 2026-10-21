import 'fake-indexeddb/auto'
import { beforeAll, describe, expect, it } from 'vitest'
import { Dictionary } from './dictionary.ts'
import { downloadAndInstall } from './download.ts'
import { DictionaryChangedError, deleteDictionary, installDictionary, openStore } from './store.ts'
import { fixtureFile, freshDbName, serveFixture } from './test-utils.ts'
import type { Entry } from './types.ts'

let dictionary: Dictionary

beforeAll(async () => {
  const { fetchFn, manifest } = await serveFixture()
  const db = await openStore(freshDbName())

  await downloadAndInstall(db, manifest, { fetchFn })
  dictionary = (await Dictionary.open(db))!
})

describe('Dictionary', () => {
  it('is undefined when nothing is installed', async () => {
    expect(await Dictionary.open(await openStore(freshDbName()))).toBeUndefined()
  })

  it('exposes the license', () => {
    expect(dictionary.info.license).toBe('test license')
  })

  it('suggests by prefix', () => {
    expect(dictionary.suggest('ap')).toEqual(['apple', 'apply', 'apt'])
    expect(dictionary.suggest('APP', 1)).toEqual(['apple'])
  })

  it('looks up an exact headword', async () => {
    const result = await dictionary.lookup('  Apple ')

    expect(result?.word).toBe('apple')
    expect(result?.entry[0][1][0][0]).toBe('a fruit')
    expect(result?.inflectedFrom).toBeUndefined()
  })

  it('resolves inflected forms to their base word', async () => {
    expect(await dictionary.lookup('ran')).toMatchObject({ word: 'run', inflectedFrom: 'ran' })
    expect(await dictionary.lookup('mice')).toMatchObject({ word: 'mouse', inflectedFrom: 'mice' })
    expect(await dictionary.lookup('running')).toMatchObject({ word: 'run' })
  })

  it('prefers an exact headword over an inflection of another word', async () => {
    expect((await dictionary.lookup('saw'))?.word).toBe('saw')
  })

  it('returns undefined for unknown or empty queries', async () => {
    expect(await dictionary.lookup('zzz')).toBeUndefined()
    expect(await dictionary.lookup('   ')).toBeUndefined()
  })

  it('picks a random headword that can be looked up', async () => {
    expect(await dictionary.lookup(dictionary.random())).toBeDefined()
  })

  it('reads entries across storage blocks', async () => {
    const db = await openStore(freshDbName())
    const words = Array.from({ length: 600 }, (_, i) => `w${String(i).padStart(4, '0')}`)
    const file = {
      ...fixtureFile(),
      words,
      entries: words.map(w => [['n', [[`def of ${w}`, [], []]]]] as Entry),
      inflections: {},
    }

    await installDictionary(db, (await serveFixture()).manifest, file)

    const opened = (await Dictionary.open(db))!

    for (const i of [0, 255, 256, 511, 512, 599]) {
      expect((await opened.lookup(words[i]))?.entry[0][1][0][0]).toBe(`def of ${words[i]}`)
    }
  })

  it('resolves many inflections across buckets, including awkward keys', async () => {
    const db = await openStore(freshDbName())
    const inflections: Record<string, string[]> = { constructor: ['run'] }

    Object.defineProperty(inflections, '__proto__', { value: ['run'], enumerable: true })

    for (let i = 0; i < 2000; i++) inflections[`form${i}`] = ['mouse']

    await installDictionary(db, (await serveFixture()).manifest, { ...fixtureFile(), inflections })

    const opened = (await Dictionary.open(db))!

    for (const form of ['constructor', '__proto__']) {
      expect((await opened.lookup(form))?.word).toBe('run')
    }

    for (const i of [0, 777, 1999]) {
      expect((await opened.lookup(`form${i}`))?.word).toBe('mouse')
    }

    expect(await opened.lookup('form2000')).toBeUndefined()
    expect(await opened.lookup('hasownproperty')).toBeUndefined()
  })

  it('refuses to mix an old word list with data from a newer install', async () => {
    const db = await openStore(freshDbName())
    const { manifest } = await serveFixture()

    await installDictionary(db, manifest, fixtureFile())

    const old = (await Dictionary.open(db))!
    const newer = { ...fixtureFile(), words: ['aaa', ...fixtureFile().words] }

    newer.entries = [[['n', [['new first entry', [], []]]]], ...fixtureFile().entries]
    await installDictionary(db, { ...manifest, version: 'newer' }, newer)

    await expect(old.lookup('apple')).rejects.toThrow(DictionaryChangedError)
    expect((await (await Dictionary.open(db))!.lookup('apple'))?.entry[0][1][0][0]).toBe('a fruit')
  })

  it('can be deleted', async () => {
    const db = await openStore(freshDbName())
    const { fetchFn, manifest } = await serveFixture()

    await downloadAndInstall(db, manifest, { fetchFn })
    await deleteDictionary(db)

    expect(await Dictionary.open(db)).toBeUndefined()
  })
})
