import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import Alert from '@mui/material/Alert'
import AppBar from '@mui/material/AppBar'
import Chip from '@mui/material/Chip'
import Container from '@mui/material/Container'
import CssBaseline from '@mui/material/CssBaseline'
import IconButton from '@mui/material/IconButton'
import Stack from '@mui/material/Stack'
import { ThemeProvider } from '@mui/material/styles'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import { useEffect, useState } from 'react'
import { CreditsDialog } from './components/CreditsDialog.tsx'
import { EntryView } from './components/EntryView.tsx'
import { SearchBox } from './components/SearchBox.tsx'
import {
  ConsentScreen,
  DeclinedScreen,
  DownloadingScreen,
  ErrorScreen,
  LoadingScreen,
} from './components/SetupScreens.tsx'
import type { Dictionary, LookupResult } from './data/index.ts'
import { addRecent, loadRecent } from './recent.ts'
import { theme } from './theme.ts'
import { useDictionarySetup } from './useDictionarySetup.ts'
import { useQuery } from './useQuery.ts'

type Lookup = { query: string; result: LookupResult | undefined }

const Search = ({ dictionary }: { dictionary: Dictionary }) => {
  const [query, setQuery] = useQuery()
  const [recent, setRecent] = useState(loadRecent)
  const [lookup, setLookup] = useState<Lookup>()

  useEffect(() => {
    if (!query) return

    let stale = false

    void dictionary.lookup(query).then(result => {
      if (stale) return

      setLookup({ query, result })

      if (result) setRecent(addRecent(result.word))
    })

    return () => {
      stale = true
    }
  }, [dictionary, query])

  // Ignore a lookup that belongs to a previous query.
  const current = lookup?.query === query && query ? lookup : undefined

  return (
    <Stack spacing={3}>
      <SearchBox dictionary={dictionary} value={query} recent={recent} onSearch={setQuery} />
      {current?.result && <EntryView result={current.result} onLookup={setQuery} />}
      {current && !current.result && (
        <Stack spacing={1}>
          <Alert severity="info">No entry found for “{current.query}”.</Alert>
          <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap' }} useFlexGap>
            {dictionary.suggest(current.query.slice(0, 3)).map(word => (
              <Chip key={word} label={word} variant="outlined" onClick={() => setQuery(word)} />
            ))}
          </Stack>
        </Stack>
      )}
    </Stack>
  )
}

const App = () => {
  const { state, download, cancel, decline, reconsider, retry } = useDictionarySetup()
  const [creditsOpen, setCreditsOpen] = useState(false)

  return (
    <ThemeProvider theme={theme} noSsr>
      <CssBaseline />
      <AppBar position="static" color="transparent" elevation={0}>
        <Toolbar>
          <Typography variant="h6" component="p" sx={{ flexGrow: 1 }}>
            Simple Dictionary
          </Typography>
          <IconButton aria-label="About and credits" onClick={() => setCreditsOpen(true)}>
            <InfoOutlinedIcon />
          </IconButton>
        </Toolbar>
      </AppBar>
      <Container maxWidth="sm" component="main" sx={{ pb: 6 }}>
        {state.status === 'loading' && <LoadingScreen />}
        {state.status === 'needs-download' && (
          <ConsentScreen
            manifest={state.manifest}
            partialBytes={state.partialBytes}
            onDownload={() => void download(state.manifest)}
            onDecline={decline}
          />
        )}
        {state.status === 'declined' && <DeclinedScreen onReconsider={reconsider} />}
        {state.status === 'downloading' && (
          <DownloadingScreen manifest={state.manifest} receivedBytes={state.receivedBytes} onCancel={cancel} />
        )}
        {state.status === 'error' && <ErrorScreen message={state.message} onRetry={retry} />}
        {state.status === 'ready' && <Search dictionary={state.dictionary} />}
      </Container>
      <CreditsDialog open={creditsOpen} onClose={() => setCreditsOpen(false)} />
    </ThemeProvider>
  )
}

export default App
