import Chip from '@mui/material/Chip'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import type { LookupResult, Pos } from '../data/index.ts'
import { Ornament } from './Ornament.tsx'
import { Page } from './Page.tsx'

const POS_NAMES: Record<Pos, string> = {
  n: 'noun',
  v: 'verb',
  a: 'adjective',
  r: 'adverb',
}

interface Props {
  result: LookupResult
  onLookup: (word: string) => void
}

export const EntryView = ({ result, onLookup }: Props) => (
  <Page label={result.word}>
    <article>
      <Typography
        variant="h1"
        sx={{ fontSize: { xs: '2.4rem', sm: '3rem' }, overflowWrap: 'anywhere' }}
      >
        {result.word}
      </Typography>
      {result.inflectedFrom && (
        <Typography color="text.secondary" sx={{ mt: 1, fontStyle: 'italic' }}>
          “{result.inflectedFrom}” is a form of “{result.word}”
        </Typography>
      )}
      <Ornament my={2.5} />
      {result.entry.map(([pos, senses]) => (
        <section key={pos} aria-label={POS_NAMES[pos]}>
          <Typography
            component="h2"
            color="primary"
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              mt: 3.5,
              mb: 2,
              fontSize: '1.15rem',
              fontStyle: 'italic',
              fontWeight: 500,
              '&::after': { content: '""', flex: 1, height: '1px', bgcolor: 'divider' },
            }}
          >
            {POS_NAMES[pos]}
          </Typography>
          <Stack
            component="ol"
            spacing={2.5}
            sx={{
              m: 0,
              pl: 3.5,
              '& > li::marker': { color: 'primary.main', fontWeight: 700 },
            }}
          >
            {senses.map(([definition, examples, synonyms], i) => (
              <li key={i}>
                <Typography>{definition}</Typography>
                {examples.map(example => (
                  <Typography
                    key={example}
                    variant="body2"
                    color="text.secondary"
                    sx={{
                      mt: 0.75,
                      pl: 1.75,
                      fontStyle: 'italic',
                      borderLeft: 2,
                      borderColor: 'divider',
                    }}
                  >
                    “{example}”
                  </Typography>
                ))}
                {synonyms.length > 0 && (
                  <Stack
                    direction="row"
                    spacing={0.75}
                    sx={{ mt: 1.25, flexWrap: 'wrap' }}
                    useFlexGap
                  >
                    {synonyms.map(synonym => (
                      <Chip
                        key={synonym}
                        label={synonym}
                        size="small"
                        onClick={() => onLookup(synonym.toLowerCase())}
                        sx={{
                          color: 'primary.main',
                          bgcolor:
                            'color-mix(in srgb, var(--mui-palette-primary-main) 9%, transparent)',
                          '&:hover': {
                            bgcolor:
                              'color-mix(in srgb, var(--mui-palette-primary-main) 18%, transparent)',
                          },
                        }}
                      />
                    ))}
                  </Stack>
                )}
              </li>
            ))}
          </Stack>
        </section>
      ))}
    </article>
  </Page>
)
