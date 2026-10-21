const KEY = 'recent-searches'
export const MAX_RECENT = 10

export const loadRecent = (): string[] => {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]')

    return Array.isArray(parsed) ? parsed.filter(w => typeof w === 'string').slice(0, MAX_RECENT) : []
  } catch {
    return []
  }
}

/** Moves `word` to the front, deduplicated, and persists. Returns the new list. */
export const addRecent = (word: string): string[] => {
  const next = [word, ...loadRecent().filter(w => w !== word)].slice(0, MAX_RECENT)

  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // Storage may be unavailable (private mode); recents are a convenience.
  }

  return next
}

export const clearRecent = (): void => {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // See addRecent.
  }
}
