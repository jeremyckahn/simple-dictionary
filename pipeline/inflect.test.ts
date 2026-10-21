import { describe, expect, it } from 'vitest'
import { generateInflections, ruleForms } from './inflect.ts'
import { loadFixtureSources } from './test-utils.ts'
import { parseWordNet } from './wordnet.ts'

describe('ruleForms', () => {
  it('inverts the noun detachment rules', () => {
    expect(ruleForms('dog', 'n')).toEqual(['dogs'])
    expect(ruleForms('bus', 'n')).toEqual(['buss', 'buses'])
    expect(ruleForms('church', 'n')).toEqual(['churchs', 'churches'])
    expect(ruleForms('box', 'n')).toEqual(['boxs', 'boxes'])
    expect(ruleForms('fly', 'n')).toEqual(['flys', 'flies'])
    expect(ruleForms('woman', 'n')).toContain('women')
  })

  it('inverts the verb detachment rules', () => {
    const forms = ruleForms('hope', 'v')
    expect(forms).toEqual(expect.arrayContaining(['hopes', 'hoped', 'hoping']))
    expect(ruleForms('try', 'v')).toContain('tries')
    expect(ruleForms('walk', 'v')).toEqual(
      expect.arrayContaining(['walks', 'walkes', 'walked', 'walking'])
    )
  })

  it('inverts the adjective rules and has none for adverbs', () => {
    expect(ruleForms('nice', 'a')).toEqual(expect.arrayContaining(['nicer', 'nicest']))
    expect(ruleForms('tall', 'a')).toEqual(['taller', 'tallest'])
    expect(ruleForms('well', 'r')).toEqual([])
  })
})

describe('generateInflections', () => {
  const inflections = generateInflections(parseWordNet(loadFixtureSources()))

  it('resolves irregular forms from the exception lists', () => {
    expect(inflections.mice).toEqual(['mouse'])
    expect(inflections.ran).toEqual(['run'])
    expect(inflections.running).toEqual(['run'])
  })

  it('resolves regular forms with suffix rules', () => {
    expect(inflections.mouses).toEqual(['mouse'])
    expect(inflections.runs).toEqual(['run'])
    expect(inflections.happier).toBeUndefined()
    expect(inflections.felicitouser).toEqual(['felicitous'])
  })

  it('lists every base for a form shared across parts of speech', () => {
    expect(inflections.better).toEqual(['good', 'well'])
  })

  it('drops exception entries whose base is not a headword of that part of speech', () => {
    expect(inflections.geese).toBeUndefined()
    expect(inflections.mouses).toEqual(['mouse'])
  })

  it('applies an exception list instead of suffix rules for a listed form', () => {
    const db = parseWordNet(loadFixtureSources())
    db.exceptions.n.push(['mouses', ['run']])
    db.index.push({ lemma: 'run', pos: 'n', tagsenseCount: 0, synsets: [] })
    expect(generateInflections(db).mouses).toEqual(['run'])
  })

  it('maps multi-word exceptions but does not run suffix rules over phrases', () => {
    expect(inflections['cities of light']).toEqual(['city of light'])
    expect(inflections['city of lights']).toBeUndefined()
  })

  it('never maps a word to itself and lists forms in sorted order', () => {
    for (const [form, bases] of Object.entries(inflections)) expect(bases).not.toContain(form)
    const keys = Object.keys(inflections)
    expect(keys).toEqual([...keys].sort())
  })
})
