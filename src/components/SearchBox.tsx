import ShuffleIcon from '@mui/icons-material/Shuffle'
import Autocomplete from '@mui/material/Autocomplete'
import IconButton from '@mui/material/IconButton'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Tooltip from '@mui/material/Tooltip'
import { useState } from 'react'
import type { Dictionary } from '../data/index.ts'

interface Props {
  dictionary: Dictionary
  /** Currently displayed query, shown in the box. */
  value: string
  recent: string[]
  onSearch: (word: string) => void
}

export const SearchBox = ({ dictionary, value, recent, onSearch }: Props) => {
  const [input, setInput] = useState(value)
  const [lastValue, setLastValue] = useState(value)

  // Keep the box in sync when navigation (back/forward, chips, random) changes the query.
  if (value !== lastValue) {
    setLastValue(value)
    setInput(value)
  }

  const options = input.trim() ? dictionary.suggest(input) : recent

  const search = (word: string) => {
    const trimmed = word.trim()

    if (trimmed) onSearch(trimmed)
  }

  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
      <Autocomplete
        freeSolo
        fullWidth
        openOnFocus
        options={options}
        filterOptions={o => o}
        inputValue={input}
        onInputChange={(_, v, reason) => {
          if (reason !== 'reset') setInput(v)
        }}
        onChange={(_, v) => {
          if (typeof v === 'string') {
            setInput(v)
            search(v)
          }
        }}
        groupBy={() => (input.trim() ? '' : 'Recent searches')}
        renderGroup={params =>
          params.group ? (
            <li key={params.key}>
              <div style={{ padding: '4px 16px', fontSize: 12, opacity: 0.7 }}>{params.group}</div>
              <ul style={{ padding: 0 }}>{params.children}</ul>
            </li>
          ) : (
            <li key={params.key}>
              <ul style={{ padding: 0 }}>{params.children}</ul>
            </li>
          )
        }
        renderInput={params => (
          <TextField
            {...params}
            autoFocus
            label="Search the dictionary"
            slotProps={{ ...params.slotProps, htmlInput: { ...params.slotProps.htmlInput, autoCapitalize: 'none', autoCorrect: 'off', spellCheck: false } }}
          />
        )}
      />
      <Tooltip title="Random word">
        <IconButton aria-label="Random word" onClick={() => search(dictionary.random())}>
          <ShuffleIcon />
        </IconButton>
      </Tooltip>
    </Stack>
  )
}
