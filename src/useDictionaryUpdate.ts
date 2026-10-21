import { useCallback, useEffect, useState } from 'react'
import { type Dictionary, downloadAndInstall, fetchManifest, type Manifest, openStore } from './data/index.ts'

export type UpdateState =
  | { status: 'idle' }
  | { status: 'available'; manifest: Manifest }
  | { status: 'downloading'; manifest: Manifest; receivedBytes: number }
  | { status: 'error'; manifest: Manifest; message: string }

/**
 * Offers a newer dictionary when the deployed manifest's version differs from
 * the installed one. The installed dictionary stays in use until the new data
 * has fully downloaded and verified; `onUpdated` then swaps in the new one.
 */
export const useDictionaryUpdate = (dictionary: Dictionary, onUpdated: () => Promise<void>) => {
  const [state, setState] = useState<UpdateState>({ status: 'idle' })
  const installedVersion = dictionary.info.manifest.version

  useEffect(() => {
    const controller = new AbortController()

    const check = () => {
      // Offline, a failed fetch, or a format this app can't read all just mean "no update now".
      fetchManifest(fetch, controller.signal)
        .then(manifest => {
          setState(s =>
            s.status === 'idle' && manifest.version !== installedVersion
              ? { status: 'available', manifest }
              : s
          )
        })
        .catch(() => {})
    }

    check()
    addEventListener('online', check)

    return () => {
      controller.abort()
      removeEventListener('online', check)
    }
  }, [installedVersion])

  const update = useCallback(
    async () => {
      if (state.status !== 'available' && state.status !== 'error') return

      const { manifest } = state

      setState({ status: 'downloading', manifest, receivedBytes: 0 })

      try {
        await downloadAndInstall(await openStore(), manifest, {
          onProgress: ({ receivedBytes }) => setState({ status: 'downloading', manifest, receivedBytes }),
        })
        await onUpdated()
        setState({ status: 'idle' })
      } catch (e) {
        setState({ status: 'error', manifest, message: e instanceof Error ? e.message : String(e) })
      }
    },
    [state, onUpdated]
  )

  const dismiss = useCallback(() => setState({ status: 'idle' }), [])

  return { state, update, dismiss }
}
