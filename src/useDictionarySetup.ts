import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Dictionary,
  downloadAndInstall,
  fetchManifest,
  getPartialBytes,
  type Manifest,
  openStore,
} from './data/index.ts'

export type SetupState =
  | { status: 'loading' }
  /** `partialBytes` > 0 means a previous attempt can be resumed. */
  | { status: 'needs-download'; manifest: Manifest; partialBytes: number }
  | { status: 'declined'; manifest: Manifest; partialBytes: number }
  | { status: 'downloading'; manifest: Manifest; receivedBytes: number }
  | { status: 'error'; message: string; manifest?: Manifest }
  | { status: 'ready'; dictionary: Dictionary }

const message = (e: unknown): string => (e instanceof Error ? e.message : String(e))

/** Drives the load -> consent -> download -> ready flow. */
export const useDictionarySetup = () => {
  const [state, setState] = useState<SetupState>({ status: 'loading' })
  const dbRef = useRef<ReturnType<typeof openStore> | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const getDb = () => (dbRef.current ??= openStore())

  const resolve = useCallback(async (): Promise<SetupState> => {
    try {
      const db = await getDb()
      const dictionary = await Dictionary.open(db)

      if (dictionary) return { status: 'ready', dictionary }

      const manifest = await fetchManifest()

      return { status: 'needs-download', manifest, partialBytes: await getPartialBytes(db) }
    } catch (e) {
      return { status: 'error', message: message(e) }
    }
  }, [])

  useEffect(() => {
    let stale = false

    void resolve().then(next => {
      if (!stale) setState(next)
    })

    return () => {
      stale = true
    }
  }, [resolve])

  const retry = useCallback(() => {
    setState({ status: 'loading' })
    void resolve().then(setState)
  }, [resolve])

  const download = useCallback(async (manifest: Manifest) => {
    const controller = new AbortController()

    abortRef.current = controller
    setState({ status: 'downloading', manifest, receivedBytes: 0 })

    const db = await getDb()

    try {
      await downloadAndInstall(db, manifest, {
        signal: controller.signal,
        onProgress: ({ receivedBytes }) => setState({ status: 'downloading', manifest, receivedBytes }),
      })

      const dictionary = await Dictionary.open(db)

      if (!dictionary) throw new Error('The dictionary could not be installed')

      setState({ status: 'ready', dictionary })
    } catch (e) {
      const partialBytes = await getPartialBytes(db).catch(() => 0)

      if (controller.signal.aborted) {
        setState({ status: 'needs-download', manifest, partialBytes })
      } else {
        setState({ status: 'error', message: message(e), manifest })
      }
    }
  }, [])

  /** Re-reads the installed dictionary, e.g. after an update replaced it. */
  const refresh = useCallback(async () => {
    const dictionary = await Dictionary.open(await getDb())

    if (dictionary) setState({ status: 'ready', dictionary })
  }, [])

  const cancel = useCallback(() => abortRef.current?.abort(), [])

  const decline = useCallback(
    () =>
      setState(s => (s.status === 'needs-download' ? { ...s, status: 'declined' } : s)),
    []
  )

  const reconsider = useCallback(
    () => setState(s => (s.status === 'declined' ? { ...s, status: 'needs-download' } : s)),
    []
  )

  return { state, download, cancel, decline, reconsider, retry, refresh }
}
