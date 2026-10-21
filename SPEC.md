# Simple Dictionary — Spec

A basic, fully offline, installable dictionary PWA. The user types a word into an
autocomplete box and sees its definition. The English dictionary is downloaded to
the client (with the user's permission) so that the app works with no network.

License: GPL-2.0-only. Dictionary data: Princeton WordNet (see Credits).

## Decisions

| Area | Decision |
|---|---|
| **Data** | Princeton WordNet 3.0, pinned and verified by SHA-256 (fetched from an npm tarball that bundles Princeton's database and morphology exception lists). Converted at build time into a single compressed, content-hashed file (e.g. `dictionary.<hash>.json.gz`) emitted into `dist/`. The generated file is not committed. |
| **Entry view** | Word, then each part of speech with numbered definitions, example sentences (where they exist), and tappable synonym chips that trigger a lookup. No antonyms or related-word hierarchy in v1. No pronunciation or etymology (not in WordNet). |
| **Search** | Case-insensitive prefix suggestions (about 10) as the user types. Inflected forms resolve to their base word ("ran" → "run", "mice" → "mouse", "running" → "run"); inflections are precomputed at build time, not computed in the browser. No typo-tolerance in v1 (possible later; it is a search-time feature and does not change the data format). |
| **Download flow** | See below. |
| **Storage** | IndexedDB via `idb`, with a sorted word index held in memory for instant prefix lookups. |
| **Stack** | TypeScript, React, Vite, npm. MUI for UI, theming (light/dark follows the system) and `Autocomplete`, fed from our own prefix index rather than MUI's built-in option filtering. `vite-plugin-pwa` (Workbox). Vitest for unit tests; Playwright for end-to-end. |
| **Branding** | Name "Simple Dictionary", short name "Dictionary". Placeholder "Aa" icon generated from a single SVG source (192, 512 and maskable PNGs); replaceable later with a one-file change. |
| **Extras in v1** | Deep links (`/?q=word`), browser back/forward, recent searches (shown when the empty search box is focused; stored locally), and a random-word button. Favorites, word of the day, and sharing are out of scope for v1. |
| **Credits** | An about/credits section containing the Princeton WordNet license notice. |

## Download and consent flow

- On first visit the service worker precaches the small app shell. The dictionary
  is **not** downloaded until the user agrees.
- A consent screen states the exact download size and offers **Download** and
  **Not now**.
- Download shows a progress bar and a cancel button. If interrupted, retry resumes
  instead of restarting.
- On completion the data is unpacked into IndexedDB, and the app calls
  `navigator.storage.persist()` to reduce the chance of eviction.
- **Declining** leaves an explanatory screen (the app cannot search without the
  data) with a button to download later. There is no online fallback.
- On Chromium, if `navigator.connection` reports Save-Data or a slow/cellular
  connection, show a metered-connection warning. This is best-effort only.
- On iOS Safari, where storage can be evicted for sites that are not installed,
  suggest installing to the home screen before downloading.
- The data file is versioned by its content hash. When a newer version ships, the
  app offers an update and keeps using the existing data until the new data has
  fully downloaded.

## Data pipeline

A script in the repo (`pipeline/`, run by `npm run build:data` and as part of
`npm run build`) downloads the pinned WordNet 3.0 release, verifies its SHA-256
(a mismatch fails the build), converts it, and writes the content-hashed output
into `dist/` with a manifest. The raw download is cached in `.cache/` between
builds. See `pipeline/README.md` for the source choice and the data format.

Measured in step 1: 147,306 headwords, 206,941 senses and 161,139 inflected
forms, 29.2 MiB of JSON, **8.7 MB (8.3 MiB) gzipped**. That is a little above
the original 6–8 MB estimate, because definitions and examples are repeated for
every lemma of a synset. Two ways to shrink it if the consent screen number
matters later: share synset text between lemmas (about 7.0 MB gzipped, at the
cost of a join when unpacking), or switch to brotli (about 5.6 MB, but
`DecompressionStream` does not support it everywhere yet). The consent screen
reads the exact size from the manifest.

## Build order

Each step is its own commit(s); every push gets a Vercel preview.

1. **Data pipeline** — download, verify, convert; unit tests. Establishes the real
   download size.
2. **Data layer** — resumable download with progress, IndexedDB storage, prefix and
   inflection search; unit tests.
3. **UI** — MUI theme, consent and decline screens, autocomplete, entry view, deep
   links, recent searches, random word.
4. **PWA** — manifest, icons, service worker, install prompt, update flow.
5. **End-to-end test** — Playwright: download the data, go offline, look up a word.

## Credits

Dictionary data is from Princeton University's WordNet. The license notice must
be reproduced in the app and in the repository (added in step 1).
