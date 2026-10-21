import { useCallback, useEffect, useState } from 'react'

const readQuery = (): string => new URLSearchParams(location.search).get('q') ?? ''

/**
 * The `?q=` search param as state. Setting it pushes a history entry, so
 * back/forward step through lookups; deep links (`/?q=word`) load directly.
 */
export const useQuery = (): [string, (q: string) => void] => {
  const [query, setQueryState] = useState(readQuery)

  useEffect(() => {
    const onPopState = () => setQueryState(readQuery())

    addEventListener('popstate', onPopState)

    return () => removeEventListener('popstate', onPopState)
  }, [])

  const setQuery = useCallback((q: string) => {
    if (q === readQuery()) return

    history.pushState(null, '', q ? `?q=${encodeURIComponent(q)}` : location.pathname)
    setQueryState(q)
  }, [])

  return [query, setQuery]
}
