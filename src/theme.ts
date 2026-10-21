import { createTheme } from '@mui/material/styles'

// Light/dark follows the system setting (no manual toggle in v1).
export const theme = createTheme({
  cssVariables: { colorSchemeSelector: 'media' },
  colorSchemes: {
    light: { palette: { primary: { main: '#1f5fbf' } } },
    dark: { palette: { primary: { main: '#8ab4f8' } } },
  },
  typography: {
    fontFamily: 'system-ui, "Segoe UI", Roboto, sans-serif',
    h1: { fontFamily: 'Georgia, "Times New Roman", serif', fontWeight: 600 },
  },
  shape: { borderRadius: 10 },
})
