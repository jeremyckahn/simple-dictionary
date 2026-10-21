import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import Alert from '@mui/material/Alert'
import InstallMobileIcon from '@mui/icons-material/InstallMobile'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Container from '@mui/material/Container'
import CssBaseline from '@mui/material/CssBaseline'
import IconButton from '@mui/material/IconButton'
import Stack from '@mui/material/Stack'
import { ThemeProvider } from '@mui/material/styles'
import Typography from '@mui/material/Typography'
import { useEffect, useState } from 'react'
import { PwaPrompts } from './components/PwaPrompts.tsx'
import { UpdateBanner } from './components/UpdateBanner.tsx'
import { CreditsDialog } from './components/CreditsDialog.tsx'
import { Ornament } from './components/Ornament.tsx'
import { EntryView } from './components/EntryView.tsx'
import { SearchBox } from './components/SearchBox.tsx'
import {
  ConsentScreen,
  DeclinedScreen,
  DownloadingScreen,
  ErrorScreen,
  LoadingScreen,
} from './components/SetupScreens.tsx'
import { type Dictionary, DictionaryChangedError, type LookupResult } from './data/index.ts'
import { addRecent, loadRecent } from './recent.ts'
import { theme } from './theme.ts'
import { useDictionarySetup } from './useDictionarySetup.ts'
import { useDictionaryUpdate } from './useDictionaryUpdate.ts'
import { useInstallPrompt } from './useInstallPrompt.ts'
import { useQuery } from './useQuery.ts'

type Lookup = { query: string; result: LookupResult | undefined }

interface SearchProps {
  dictionary: Dictionary
  /** Called when the stored dictionary changed under us; reopen it. */
  onStale: () => Promise<void>
}

const Search = ({ dictionary, onStale }: SearchProps) => {
  const update = useDictionaryUpdate(dictionary, onStale)
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
    }).catch(e => {
      // An update replaced the data mid-lookup; reopening re-runs this lookup.
      if (e instanceof DictionaryChangedError) void onStale()
    })

    return () => {
      stale = true
    }
  }, [dictionary, query, onStale])

  // Ignore a lookup that belongs to a previous query.
  const current = lookup?.query === query && query ? lookup : undefined

  return (
    <Stack spacing={3}>
      <UpdateBanner
        state={update.state}
        onUpdate={() => void update.update()}
        onDismiss={update.dismiss}
      />
      <SearchBox dictionary={dictionary} value={query} recent={recent} onSearch={setQuery} />
      {!query && (
        <Typography color="text.secondary" sx={{ fontStyle: 'italic', textAlign: 'center', pt: 2 }}>
          A quiet little dictionary. Type a word to begin, or open a page at random.
        </Typography>
      )}
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
  const { state, download, cancel, decline, reconsider, retry, refresh } = useDictionarySetup()
  const { canInstall, install } = useInstallPrompt()
  const [creditsOpen, setCreditsOpen] = useState(false)

  return (
    <ThemeProvider theme={theme} noSsr>
      <CssBaseline enableColorScheme />
      <Container maxWidth="sm" component="header" sx={{ pt: { xs: 2, sm: 4 } }}>
        <Stack direction="row" sx={{ alignItems: 'center' }}>
          <Typography
            component="p"
            sx={{ flexGrow: 1, fontSize: '1.35rem', fontWeight: 600, letterSpacing: '0.01em' }}
          >
            Simple Dictionary
          </Typography>
          {canInstall && (
            <Button startIcon={<InstallMobileIcon />} onClick={() => void install()}>
              Install
            </Button>
          )}
          <IconButton aria-label="About and credits" onClick={() => setCreditsOpen(true)}>
            <InfoOutlinedIcon />
          </IconButton>
        </Stack>
        <Ornament my={1} />
      </Container>
      <Container maxWidth="sm" component="main" sx={{ pt: 2, pb: 8 }}>
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
        {state.status === 'ready' && <Search dictionary={state.dictionary} onStale={refresh} />}
      </Container>
      <PwaPrompts />
      <CreditsDialog open={creditsOpen} onClose={() => setCreditsOpen(false)} />
    </ThemeProvider>
  )
}

export default App
