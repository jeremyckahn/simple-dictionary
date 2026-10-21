import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import Link from '@mui/material/Link'
import Typography from '@mui/material/Typography'
import licenses from '../../THIRD_PARTY_LICENSES?raw'

interface Props {
  open: boolean
  onClose: () => void
}

export const CreditsDialog = ({ open, onClose }: Props) => (
  <Dialog open={open} onClose={onClose} scroll="paper" fullWidth maxWidth="sm">
    <DialogTitle>About Simple Dictionary</DialogTitle>
    <DialogContent dividers>
      <Typography gutterBottom>
        Definitions come from{' '}
        <Link href="https://wordnet.princeton.edu/" target="_blank" rel="noreferrer">
          Princeton University's WordNet
        </Link>
        . Simple Dictionary is free software under the GPL-2.0 license; its{' '}
        <Link href="https://github.com/jeremyckahn/simple-dictionary" target="_blank" rel="noreferrer">
          source code
        </Link>{' '}
        is on GitHub.
      </Typography>
      <Typography component="pre" variant="caption" sx={{ whiteSpace: 'pre-wrap', fontFamily: 'ui-monospace, monospace' }}>
        {licenses}
      </Typography>
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose}>Close</Button>
    </DialogActions>
  </Dialog>
)
