import CloudDownloadIcon from '@mui/icons-material/CloudDownload'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import LinearProgress from '@mui/material/LinearProgress'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import type { Manifest } from '../data/index.ts'
import { formatBytes, isMeteredConnection, shouldSuggestInstall } from '../env.ts'

export const LoadingScreen = () => (
  <Stack sx={{ alignItems: 'center', py: 8 }}>
    <LinearProgress sx={{ width: 160 }} aria-label="Loading" />
  </Stack>
)

interface ConsentProps {
  manifest: Manifest
  partialBytes: number
  onDownload: () => void
  onDecline: () => void
}

export const ConsentScreen = ({ manifest, partialBytes, onDownload, onDecline }: ConsentProps) => (
  <Stack spacing={2} sx={{ py: 4 }}>
    <Typography variant="h2" sx={{ fontSize: '1.5rem' }}>
      Download the dictionary
    </Typography>
    <Typography>
      Simple Dictionary works offline. To search, it needs to store the English dictionary
      ({manifest.wordCount.toLocaleString()} words) on this device. The download is{' '}
      <strong>{formatBytes(manifest.compressedBytes)}</strong>, and happens only once.
    </Typography>
    {isMeteredConnection() && (
      <Alert severity="warning">
        You appear to be on a metered or slow connection. Consider downloading on Wi-Fi.
      </Alert>
    )}
    {shouldSuggestInstall() && (
      <Alert severity="info">
        Your browser may delete stored data for sites that aren't installed. For best results,
        add this app to your Home Screen (Share, then Add to Home Screen) before downloading.
      </Alert>
    )}
    {partialBytes > 0 && (
      <Typography variant="body2" color="text.secondary">
        A previous download was interrupted at {formatBytes(partialBytes)}; it will resume where it
        stopped.
      </Typography>
    )}
    <Stack direction="row" spacing={1}>
      <Button variant="contained" startIcon={<CloudDownloadIcon />} onClick={onDownload}>
        {partialBytes > 0 ? 'Resume download' : 'Download'}
      </Button>
      <Button onClick={onDecline}>Not now</Button>
    </Stack>
  </Stack>
)

export const DeclinedScreen = ({ onReconsider }: { onReconsider: () => void }) => (
  <Stack spacing={2} sx={{ py: 4 }}>
    <Typography variant="h2" sx={{ fontSize: '1.5rem' }}>
      The dictionary isn't downloaded
    </Typography>
    <Typography>
      Simple Dictionary can't search until the dictionary data is stored on this device. There is no
      online fallback; once downloaded, it works fully offline.
    </Typography>
    <div>
      <Button variant="contained" onClick={onReconsider}>
        Download later…
      </Button>
    </div>
  </Stack>
)

interface DownloadingProps {
  manifest: Manifest
  receivedBytes: number
  onCancel: () => void
}

export const DownloadingScreen = ({ manifest, receivedBytes, onCancel }: DownloadingProps) => {
  const percent = Math.min(100, (receivedBytes / manifest.compressedBytes) * 100)

  return (
    <Stack spacing={2} sx={{ py: 4 }}>
      <Typography variant="h2" sx={{ fontSize: '1.5rem' }}>
        Downloading…
      </Typography>
      <LinearProgress
        variant="determinate"
        value={percent}
        aria-label="Download progress"
        sx={{ height: 8, borderRadius: 4 }}
      />
      <Typography variant="body2" color="text.secondary">
        {formatBytes(receivedBytes)} of {formatBytes(manifest.compressedBytes)} ({Math.floor(percent)}%)
      </Typography>
      <div>
        <Button onClick={onCancel}>Cancel</Button>
      </div>
    </Stack>
  )
}

export const ErrorScreen = ({ message, onRetry }: { message: string; onRetry: () => void }) => (
  <Stack spacing={2} sx={{ py: 4 }}>
    <Alert severity="error">{message}</Alert>
    <div>
      <Button variant="contained" onClick={onRetry}>
        Try again
      </Button>
    </div>
  </Stack>
)
