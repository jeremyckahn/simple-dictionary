import GitHubIcon from '@mui/icons-material/GitHub'
import Button from '@mui/material/Button'
import Divider from '@mui/material/Divider'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import Link from '@mui/material/Link'
import Typography from '@mui/material/Typography'
import licenses from '../../THIRD_PARTY_LICENSES?raw'
import { toLicenseBlocks } from '../licenseBlocks.ts'

const SOURCE_URL = 'https://github.com/jeremyckahn/simple-dictionary'

const licenseBlocks = toLicenseBlocks(licenses)

interface Props {
  open: boolean
  onClose: () => void
}

export const CreditsDialog = ({ open, onClose }: Props) => (
  <Dialog open={open} onClose={onClose} scroll="paper" fullWidth maxWidth="sm">
    <DialogTitle>About Simple Dictionary</DialogTitle>
    <DialogContent dividers>
      <Typography gutterBottom>
        A simple English dictionary that works offline. It is free software, released under the
        GPL-2.0 license.
      </Typography>
      <Button
        component="a"
        variant="outlined"
        href={SOURCE_URL}
        target="_blank"
        rel="noreferrer"
        startIcon={<GitHubIcon />}
        sx={{ mt: 1, mb: 3 }}
      >
        View the source code on GitHub
      </Button>
      <Typography gutterBottom>
        Definitions come from{' '}
        <Link href="https://wordnet.princeton.edu/" target="_blank" rel="noreferrer">
          Princeton University's WordNet
        </Link>
        .
      </Typography>
      {licenseBlocks.map((block, i) =>
        block.kind === 'rule' ? (
          <Divider key={i} sx={{ my: 2 }} />
        ) : (
          <Typography
            key={i}
            variant={block.kind === 'heading' ? 'subtitle1' : 'body2'}
            color={block.kind === 'heading' ? 'text.primary' : 'text.secondary'}
            sx={{
              fontWeight: block.kind === 'heading' ? 600 : undefined,
              mt: block.kind === 'heading' ? 2 : 0,
              mb: 1.5,
            }}
          >
            {block.text}
          </Typography>
        )
      )}
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose}>Close</Button>
    </DialogActions>
  </Dialog>
)
