import type { Pos } from './types.ts'
import { POS_LIST, type WordNetDb } from './wordnet.ts'

/**
 * WordNet's morphy "detachment" rules, as `[suffix of the inflected form,
 * replacement giving the base]`. Morphy applies them in the inflected->base
 * direction at search time; we apply them in reverse to every headword at
 * build time, so the browser only needs a map lookup.
 */
export const DETACH_RULES: Record<Pos, ReadonlyArray<readonly [string, string]>> = {
  n: [
    ['s', ''],
    ['ses', 's'],
    ['xes', 'x'],
    ['zes', 'z'],
    ['ches', 'ch'],
    ['shes', 'sh'],
    ['men', 'man'],
    ['ies', 'y'],
  ],
  v: [
    ['s', ''],
    ['ies', 'y'],
    ['es', 'e'],
    ['es', ''],
    ['ed', 'e'],
    ['ed', ''],
    ['ing', 'e'],
    ['ing', ''],
  ],
  a: [
    ['er', ''],
    ['est', ''],
    ['er', 'e'],
    ['est', 'e'],
  ],
  r: [],
}

/** Inflected forms the suffix rules would produce for `base`. */
export const ruleForms = (base: string, pos: Pos): string[] => {
  const forms: string[] = []
  for (const [suffix, replacement] of DETACH_RULES[pos]) {
    if (!base.endsWith(replacement)) continue
    const stem = base.slice(0, base.length - replacement.length)
    if (!stem) continue
    forms.push(stem + suffix)
  }
  return forms
}

/**
 * Maps inflected forms to their base headwords.
 *
 * Mirrors morphy: a form listed in a part of speech's exception list resolves
 * only through that list (so "mice" -> "mouse" and never via suffix rules),
 * otherwise through the suffix rules. Bases that are not real headwords of
 * that part of speech are dropped, as are multi-word phrases for the rules.
 * Irregular bases come first for each form.
 */
export const generateInflections = (db: WordNetDb): Record<string, string[]> => {
  const headwords = {} as Record<Pos, Set<string>>
  for (const pos of POS_LIST) headwords[pos] = new Set()
  for (const entry of db.index) headwords[entry.pos].add(entry.lemma)

  const map = new Map<string, string[]>()
  const add = (form: string, base: string) => {
    if (form === base) return
    const bases = map.get(form)
    if (!bases) map.set(form, [base])
    else if (!bases.includes(base)) bases.push(base)
  }

  const exceptionForms = {} as Record<Pos, Set<string>>
  for (const pos of POS_LIST) {
    exceptionForms[pos] = new Set(db.exceptions[pos].map(([form]) => form))
    for (const [form, bases] of db.exceptions[pos]) {
      for (const base of bases) if (headwords[pos].has(base)) add(form, base)
    }
  }

  for (const pos of POS_LIST) {
    for (const base of [...headwords[pos]].sort()) {
      if (base.includes(' ')) continue
      for (const form of ruleForms(base, pos)) {
        if (!exceptionForms[pos].has(form)) add(form, base)
      }
    }
  }

  return Object.fromEntries([...map].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
}
