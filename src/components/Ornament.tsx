import Box from '@mui/material/Box'

/** A quiet printer's rule with a small diamond, used between sections. */
export const Ornament = ({ my = 2 }: { my?: number }) => (
  <Box
    aria-hidden
    sx={{ display: 'flex', alignItems: 'center', gap: 1.5, my, color: 'text.secondary' }}
  >
    <Box sx={{ flex: 1, height: '1px', bgcolor: 'divider' }} />
    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" opacity="0.7">
      <path d="M6 0.5 11.5 6 6 11.5 0.5 6z" />
    </svg>
    <Box sx={{ flex: 1, height: '1px', bgcolor: 'divider' }} />
  </Box>
)
