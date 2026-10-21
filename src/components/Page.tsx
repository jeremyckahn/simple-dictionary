import Paper from '@mui/material/Paper'
import type { ReactNode } from 'react'

/** A "page" of paper that content sits on. */
export const Page = ({ children, label }: { children: ReactNode; label?: string }) => (
  <Paper
    component="section"
    variant="outlined"
    aria-label={label}
    sx={{
      p: { xs: 3, sm: 5 },
      borderRadius: '16px',
      boxShadow:
        '0 18px 40px -24px color-mix(in srgb, var(--mui-palette-text-primary) 40%, transparent)',
    }}
  >
    {children}
  </Paper>
)
