import Button from '@mui/material/Button'
import Snackbar from '@mui/material/Snackbar'
import { useRegisterSW } from 'virtual:pwa-register/react'

const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000

/** Offers a newly deployed app version; the user decides when to reload. */
export const PwaPrompts = () => {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (registration) setInterval(() => void registration.update(), UPDATE_CHECK_INTERVAL_MS)
    },
  })

  return (
    <Snackbar
      open={needRefresh}
      message="A new version of Simple Dictionary is available."
      action={
        <>
          <Button color="inherit" size="small" onClick={() => setNeedRefresh(false)}>
            Later
          </Button>
          <Button size="small" onClick={() => void updateServiceWorker(true)}>
            Reload
          </Button>
        </>
      }
    />
  )
}
