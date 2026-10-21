import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import LinearProgress from '@mui/material/LinearProgress'
import Stack from '@mui/material/Stack'
import { formatBytes } from '../env.ts'
import type { UpdateState } from '../useDictionaryUpdate.ts'

interface Props {
  state: UpdateState
  onUpdate: () => void
  onDismiss: () => void
}

export const UpdateBanner = ({ state, onUpdate, onDismiss }: Props) => {
  if (state.status === 'idle') return null

  if (state.status === 'downloading') {
    const percent = Math.min(100, (state.receivedBytes / state.manifest.compressedBytes) * 100)

    return (
      <Alert severity="info" icon={false}>
        <Stack spacing={1}>
          <span>
            Downloading dictionary update… {Math.floor(percent)}% (you can keep searching meanwhile)
          </span>
          <LinearProgress variant="determinate" value={percent} aria-label="Update progress" />
        </Stack>
      </Alert>
    )
  }

  return (
    <Alert
      severity={state.status === 'error' ? 'error' : 'info'}
      action={
        <>
          <Button color="inherit" size="small" onClick={onDismiss}>
            Later
          </Button>
          <Button color="inherit" size="small" onClick={onUpdate}>
            {state.status === 'error' ? 'Retry' : 'Update'}
          </Button>
        </>
      }
    >
      {state.status === 'error'
        ? `The dictionary update failed: ${state.message}`
        : `A dictionary update is available (${formatBytes(state.manifest.compressedBytes)}). Your current dictionary keeps working until it finishes.`}
    </Alert>
  )
}
