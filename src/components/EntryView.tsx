import Chip from '@mui/material/Chip'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import type { LookupResult, Pos } from '../data/index.ts'

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
  <article>
    <Typography variant="h1" sx={{ fontSize: '2.25rem' }}>
      {result.word}
    </Typography>
    {result.inflectedFrom && (
      <Typography color="text.secondary" sx={{ mt: 0.5 }}>
        “{result.inflectedFrom}” is a form of “{result.word}”
      </Typography>
    )}
    {result.entry.map(([pos, senses]) => (
      <section key={pos} aria-label={POS_NAMES[pos]}>
        <Typography variant="overline" color="primary" component="h2" sx={{ display: 'block', mt: 3 }}>
          {POS_NAMES[pos]}
        </Typography>
        <Stack component="ol" spacing={2} sx={{ m: 0, pl: 3 }}>
          {senses.map(([definition, examples, synonyms], i) => (
            <li key={i}>
              <Typography>{definition}</Typography>
              {examples.map(example => (
                <Typography key={example} variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                  “{example}”
                </Typography>
              ))}
              {synonyms.length > 0 && (
                <Stack direction="row" spacing={0.5} sx={{ mt: 1, flexWrap: 'wrap' }} useFlexGap>
                  {synonyms.map(synonym => (
                    <Chip
                      key={synonym}
                      label={synonym}
                      size="small"
                      variant="outlined"
                      onClick={() => onLookup(synonym.toLowerCase())}
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
)
