// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App.tsx'
import type { Entry, Manifest } from './data/index.ts'

const manifest = {
  format: 1,
  version: 'v1',
  file: 'dictionary.v1.json.gz',
  compressedBytes: 8_725_231,
  wordCount: 147_306,
} as Manifest

const entries: Record<string, Entry> = {
  run: [['v', [['move fast by using legs', ['The children ran to the store'], ['sprint']], ['operate', [], []]]]],
  sprint: [['v', [['run fast', [], []]]]],
  mouse: [['n', [['a rodent', [], []]]]],
}
const words = Object.keys(entries).sort()
const inflections: Record<string, string> = { ran: 'run', mice: 'mouse' }

const fakeDictionary = {
  suggest: (prefix: string) => words.filter(w => w.startsWith(prefix.toLowerCase())),
  random: () => 'mouse',
  lookup: async (query: string) => {
    const q = query.toLowerCase()
    const word = entries[q] ? q : inflections[q]

    return word ? { word, entry: entries[word], inflectedFrom: word === q ? undefined : q } : undefined
  },
}

const mocks = vi.hoisted(() => ({
  installed: false,
  partialBytes: 0,
  download: undefined as undefined | ((o: { onProgress: (p: unknown) => void; signal: AbortSignal }) => Promise<void>),
}))

vi.mock('./data/index.ts', () => ({
  openStore: async () => ({}),
  getPartialBytes: async () => mocks.partialBytes,
  fetchManifest: async () => manifest,
  Dictionary: {
    open: async () => (mocks.installed ? fakeDictionary : undefined),
  },
  downloadAndInstall: async (_db: unknown, _m: unknown, options: Parameters<NonNullable<typeof mocks.download>>[0]) => {
    if (mocks.download) return mocks.download(options)

    options.onProgress({ receivedBytes: manifest.compressedBytes / 2, totalBytes: manifest.compressedBytes })
    mocks.installed = true
  },
}))

const searchBox = () => screen.findByRole('combobox', { name: 'Search the dictionary' })

beforeEach(() => {
  mocks.installed = false
  mocks.partialBytes = 0
  mocks.download = undefined
  localStorage.clear()
  history.replaceState(null, '', '/')
})

afterEach(cleanup)

describe('setup flow', () => {
  it('asks for consent with the exact size, then downloads and shows the search box', async () => {
    const user = userEvent.setup()

    render(<App />)

    expect(await screen.findByText('8.3 MB')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Download' }))

    expect(await searchBox()).toBeInTheDocument()
  })

  it('shows progress while downloading and supports cancel', async () => {
    const user = userEvent.setup()

    mocks.download = ({ onProgress, signal }) =>
      new Promise((_, reject) => {
        onProgress({ receivedBytes: manifest.compressedBytes / 2, totalBytes: manifest.compressedBytes })
        signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
      })

    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Download' }))

    expect(await screen.findByRole('progressbar', { name: 'Download progress' })).toHaveAttribute('aria-valuenow', '50')

    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(await screen.findByRole('button', { name: 'Download' })).toBeInTheDocument()
  })

  it('offers to resume an interrupted download', async () => {
    mocks.partialBytes = 1_048_576

    render(<App />)

    expect(await screen.findByRole('button', { name: 'Resume download' })).toBeInTheDocument()
  })

  it('explains what declining means and lets the user change their mind', async () => {
    const user = userEvent.setup()

    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Not now' }))

    expect(screen.getByText(/can't search until/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Download later/ }))

    expect(screen.getByRole('button', { name: 'Download' })).toBeInTheDocument()
  })

  it('shows an error with retry when the download fails', async () => {
    const user = userEvent.setup()

    mocks.download = async () => {
      throw new Error('Download failed (500)')
    }
    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Download' }))

    expect(await screen.findByText('Download failed (500)')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })

  it('goes straight to search when the dictionary is installed', async () => {
    mocks.installed = true

    render(<App />)

    expect(await searchBox()).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Download' })).not.toBeInTheDocument()
  })
})

describe('searching', () => {
  beforeEach(() => {
    mocks.installed = true
  })

  it('suggests by prefix and shows an entry, updating the URL', async () => {
    const user = userEvent.setup()

    render(<App />)
    await user.type(await searchBox(), 'mo')

    expect(await screen.findByRole('option', { name: 'mouse' })).toBeInTheDocument()

    await user.click(screen.getByRole('option', { name: 'mouse' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'mouse' })).toBeInTheDocument()
    expect(screen.getByText('a rodent')).toBeInTheDocument()
    expect(location.search).toBe('?q=mouse')
  })

  it('says when an inflected form was resolved', async () => {
    const user = userEvent.setup()

    render(<App />)
    await user.type(await searchBox(), 'ran{Enter}')

    expect(await screen.findByRole('heading', { level: 1, name: 'run' })).toBeInTheDocument()
    expect(screen.getByText(/“ran” is a form of “run”/)).toBeInTheDocument()
  })

  it('looks up a synonym when its chip is tapped', async () => {
    const user = userEvent.setup()

    render(<App />)
    await user.type(await searchBox(), 'run{Enter}')
    await user.click(await screen.findByRole('button', { name: 'sprint' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'sprint' })).toBeInTheDocument()
  })

  it('loads a deep link', async () => {
    history.replaceState(null, '', '/?q=mice')

    render(<App />)

    expect(await screen.findByRole('heading', { level: 1, name: 'mouse' })).toBeInTheDocument()
    expect(await searchBox()).toHaveValue('mice')
  })

  it('follows browser back and forward', async () => {
    const user = userEvent.setup()

    render(<App />)
    await user.type(await searchBox(), 'run{Enter}')
    await screen.findByRole('heading', { level: 1, name: 'run' })
    await user.click(await screen.findByRole('button', { name: 'sprint' }))
    await screen.findByRole('heading', { level: 1, name: 'sprint' })

    history.back()

    expect(await screen.findByRole('heading', { level: 1, name: 'run' })).toBeInTheDocument()
    await waitFor(() => expect(location.search).toBe('?q=run'))
  })

  it('reports unknown words', async () => {
    const user = userEvent.setup()

    render(<App />)
    await user.type(await searchBox(), 'zzz{Enter}')

    expect(await screen.findByText(/No entry found for “zzz”/)).toBeInTheDocument()
  })

  it('shows recent searches when the empty box is focused', async () => {
    const user = userEvent.setup()

    render(<App />)
    await user.type(await searchBox(), 'run{Enter}')
    await screen.findByRole('heading', { level: 1, name: 'run' })
    await user.clear(await searchBox())
    await user.click(await searchBox())

    expect(await screen.findByRole('option', { name: 'run' })).toBeInTheDocument()
    expect(screen.getByText('Recent searches')).toBeInTheDocument()
  })

  it('looks up a random word', async () => {
    const user = userEvent.setup()

    render(<App />)
    await searchBox()
    await user.click(screen.getByRole('button', { name: 'Random word' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'mouse' })).toBeInTheDocument()
  })
})

describe('credits', () => {
  it('shows the WordNet license notice', async () => {
    const user = userEvent.setup()

    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'About and credits' }))

    expect(await screen.findByText(/WordNet 3\.0/)).toBeInTheDocument()
    expect(screen.getByText(/Princeton University/, { selector: 'a' })).toBeInTheDocument()
  })
})
