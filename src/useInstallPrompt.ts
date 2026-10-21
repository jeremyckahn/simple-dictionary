import { useCallback, useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/**
 * Captures Chromium's `beforeinstallprompt` so the app can offer its own
 * Install button. Unavailable (and `canInstall` false) on Safari/Firefox and
 * once installed.
 */
export const useInstallPrompt = () => {
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setEvent(e as BeforeInstallPromptEvent)
    }
    const onInstalled = () => setEvent(null)

    addEventListener('beforeinstallprompt', onPrompt)
    addEventListener('appinstalled', onInstalled)

    return () => {
      removeEventListener('beforeinstallprompt', onPrompt)
      removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const install = useCallback(async () => {
    if (!event) return

    await event.prompt()
    await event.userChoice

    // The event can only be used once, whatever the user chose.
    setEvent(null)
  }, [event])

  return { canInstall: event !== null, install }
}
