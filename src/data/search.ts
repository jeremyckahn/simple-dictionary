/**
 * Pure search helpers over the sorted headword list. `words` must be sorted
 * in UTF-16 code unit order (what the build pipeline guarantees).
 */

/** Index of the first word >= `target`. */
export const lowerBound = (words: readonly string[], target: string): number => {
  let lo = 0
  let hi = words.length

  while (lo < hi) {
    const mid = (lo + hi) >>> 1

    if (words[mid] < target) {
      lo = mid + 1
    } else {
      hi = mid
    }
  }

  return lo
}

export const normalizeQuery = (query: string): string =>
  query.trim().replace(/\s+/g, ' ').toLowerCase()

/** Index of the exact headword, or -1. */
export const indexOfWord = (words: readonly string[], word: string): number => {
  const i = lowerBound(words, word)

  return words[i] === word ? i : -1
}

/** Up to `limit` headwords starting with `prefix`, in alphabetical order. */
export const prefixSearch = (
  words: readonly string[],
  prefix: string,
  limit = 10
): string[] => {
  const p = normalizeQuery(prefix)
  const results: string[] = []

  if (!p) return results

  for (let i = lowerBound(words, p); i < words.length && results.length < limit; i++) {
    if (!words[i].startsWith(p)) break

    results.push(words[i])
  }

  return results
}
