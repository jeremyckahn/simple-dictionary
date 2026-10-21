# Data pipeline

`npm run build:data` (also run by `npm run build`, after `vite build`) turns
Princeton WordNet into the single file the app downloads. Output goes to
`dist/` (or the directory given as the first argument):

- `dictionary.<version>.json.gz` — the data, gzip level 9. `<version>` is the
  first 16 hex digits of the SHA-256 of the uncompressed JSON.
- `dictionary-manifest.json` — file name, version, SHA-256 of the JSON and of
  the `.gz`, compressed and uncompressed byte sizes, and word, sense and
  inflection counts.

## Source and verification

WordNet **3.0**, fetched from the immutable npm tarball
`wndb-with-exceptions@3.0.2` (URL and SHA-256 pinned in `config.ts`). It
contains Princeton's unmodified `WNdb-3.0.tar.gz` (the `dict/` database) plus
WordNet's morphology exception lists (`*.exc`), which none of the other
WordNet npm packages ship. The download is verified against the committed
SHA-256; a mismatch fails the build, is never retried and never cached.

Why not Princeton's own host: `wordnetcode.princeton.edu` refused connections
from the sandbox this pipeline was written in, so a hash for its tarballs
could not be established. WordNet 3.1 is available from npm as `wordnet-db`
but lacks the `*.exc` files, and mixing releases was not worth it. To switch
to a Princeton tarball later, change `WORDNET_SOURCE` and `ARCHIVE_LAYOUT` in
`config.ts` and re-derive the hash.

The raw download is cached in `.cache/` (gitignored) and re-verified on every
use. It can be seeded manually for offline builds.

## Data file format

Plain JSON (see `types.ts` for the authoritative definition):

```jsonc
{
  "format": 1,
  "wordnet": "3.0",
  "license": "…WordNet license notice…",
  "words": ["a", "a cappella", …],           // sorted, lowercase headwords
  "entries": [                                // entries[i] is the body of words[i]
    [["n", [["definition", ["example"], ["synonym"]], …]], ["v", […]]]
  ],
  "inflections": { "ran": ["run"], "mice": ["mouse"], … }
}
```

- `words` is sorted in UTF-16 code unit order, so exact and prefix search are
  binary searches (prefix `p`: first index ≥ `p` until a word stops starting
  with `p`). It is the only thing needed to build the autocomplete index.
- An entry is one group per part of speech (`n`, `v`, `a`, `r`), commonest
  first; senses within a group follow WordNet's sense numbering (commonest
  first). Sense number = array index + 1.
- A sense is `[definition, examples, synonyms]`. Synonyms are the other lemmas
  of the sense's synset (original casing). Antonyms, hypernyms and all other
  relations are deliberately excluded.
- `inflections` maps an inflected form to the headwords it may come from.
  Irregular forms from the `*.exc` lists (`ran`, `mice`, `running`) come
  first, then forms from WordNet's morphy suffix rules (`-s`, `-es`, `-ed`,
  `-ing`, `-er`, `-est`, …) applied in reverse to every single-word headword.
  A form may also be a headword in its own right (`saw`, `running`); the app
  decides how to present that. The suffix rules over-generate harmless
  non-words (`mouses`), exactly as WordNet's own morphy accepts them.
  Multi-word phrases only get inflections that appear in the exception lists.

The compressed file is served as a plain download (not `Content-Encoding`),
so the app decompresses it with `DecompressionStream('gzip')`. Brotli would be
about a third smaller but `DecompressionStream` does not support it
everywhere yet.
