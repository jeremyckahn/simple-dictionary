# Simple Dictionary

A basic, fully offline, installable English dictionary (PWA). Type a word, see
its definitions. The dictionary is downloaded to the device once, with the
user's permission (about 8 MB), and then works with no network.

- Data: Princeton [WordNet](https://wordnet.princeton.edu/) 3.0 (see
  [THIRD_PARTY_LICENSES](THIRD_PARTY_LICENSES)).
- Stack: TypeScript, React, Vite, MUI, IndexedDB (`idb`), `vite-plugin-pwa`.
- Design decisions and build order: [SPEC.md](SPEC.md).
- License: GPL-2.0-only.

## Development

```sh
npm install
npm run build        # app + service worker + dictionary data into dist/
npm run dev          # dev server (serves the dictionary from dist/, so build once first)
npm run lint
npm test             # unit and component tests (Vitest)
npm run test:e2e     # end-to-end tests (Playwright), see below
```

`npm run build` also generates the offline dictionary data
(see [pipeline/README.md](pipeline/README.md)); `npm run build:data` regenerates
just the data. The icons are generated at build time from `public/icon.svg`;
replace that one file to rebrand.

## End-to-end tests

`npm run test:e2e` builds the production app, serves it with `vite preview`,
and drives it in Chromium: consent before download, download and install,
resuming an interrupted download, then lookups (prefix suggestions, inflections,
deep links, synonyms, back/forward) with the network turned off. Install the
browser once with `npx playwright install chromium`, or point
`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` at an existing Chromium.
