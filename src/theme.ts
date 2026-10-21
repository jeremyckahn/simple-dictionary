import { createTheme } from '@mui/material/styles'

const serif =
  '"Literata Variable", Georgia, "Iowan Old Style", "Palatino Linotype", "Times New Roman", serif'

/**
 * "Cream paper and ink": warm paper, brown-black text, an oxblood accent by
 * day and lamplit amber by night. Light/dark follows the system setting (no
 * manual toggle in v1). Text pairs are all WCAG AA or better.
 */
export const theme = createTheme({
  cssVariables: { colorSchemeSelector: 'media' },
  colorSchemes: {
    light: {
      palette: {
        primary: { main: '#8a3a2f', contrastText: '#fffaf1' },
        background: { default: '#f6efe2', paper: '#fffaf1' },
        text: { primary: '#2e2418', secondary: '#665642' },
        divider: 'rgba(74, 52, 30, 0.2)',
      },
    },
    dark: {
      palette: {
        primary: { main: '#e2a877', contrastText: '#241c14' },
        background: { default: '#1b1611', paper: '#241d16' },
        text: { primary: '#ece1cc', secondary: '#b8a98f' },
        divider: 'rgba(236, 225, 204, 0.18)',
      },
    },
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: serif,
    body1: { fontSize: '1.0625rem', lineHeight: 1.7 },
    body2: { fontSize: '0.95rem', lineHeight: 1.65 },
    h1: { fontWeight: 600, letterSpacing: '-0.015em', lineHeight: 1.15 },
    h2: { fontWeight: 600, letterSpacing: '-0.01em', lineHeight: 1.25 },
    button: { textTransform: 'none', fontWeight: 600, letterSpacing: 0 },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: theme => ({
        // The page must paint the whole window itself: relying on the browser to
        // propagate the body's background to the canvas leaves a black strip below
        // short pages when anything else (an extension, forced dark mode) paints <html>.
        html: { backgroundColor: theme.vars.palette.background.default },
        body: {
          minHeight: '100dvh',
          fontKerning: 'normal',
          fontVariantLigatures: 'common-ligatures',
        },
        '::selection': {
          backgroundColor: `color-mix(in srgb, ${theme.vars.palette.primary.main} 28%, transparent)`,
        },
      }),
    },
    MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: { root: { borderRadius: 10, paddingInline: 18 } },
    },
    MuiChip: {
      styleOverrides: { root: { fontStyle: 'italic' } },
    },
    MuiAlert: {
      styleOverrides: { root: { borderRadius: 12, alignItems: 'center' } },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: ({ theme }) => ({
          backgroundColor: theme.vars.palette.background.paper,
          fontSize: '1.1rem',
        }),
      },
    },
    MuiAutocomplete: {
      styleOverrides: {
        paper: ({ theme }) => ({
          marginTop: 6,
          border: `1px solid ${theme.vars.palette.divider}`,
          boxShadow: `0 16px 36px -18px color-mix(in srgb, ${theme.vars.palette.text.primary} 45%, transparent)`,
        }),
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: ({ theme }) => ({ border: `1px solid ${theme.vars.palette.divider}` }),
      },
    },
  },
})
