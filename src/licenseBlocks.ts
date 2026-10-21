export type LicenseBlock =
  | { kind: 'heading'; text: string }
  | { kind: 'rule' }
  | { kind: 'text'; text: string }

/** Joins hard-wrapped lines, healing an ALL-CAPS word split with a hyphen (MERCHANT-/ABILITY). */
const joinLines = (lines: string[]): string =>
  lines.reduce(
    (joined, line) =>
      /[A-Z]-$/.test(joined) && /^[A-Z]/.test(line)
        ? joined.slice(0, -1) + line
        : joined
          ? `${joined} ${line}`
          : line,
    ''
  )

/**
 * Turns a hard-wrapped plain-text notice (about 78 columns, blank lines between
 * paragraphs, `---` rules, `===` title underlines) into blocks that reflow to
 * any screen width. The wording is untouched; only line breaks change.
 */
export const toLicenseBlocks = (text: string): LicenseBlock[] => {
  const blocks: LicenseBlock[] = []
  let paragraph: string[] = []

  const flush = () => {
    if (paragraph.length) blocks.push({ kind: 'text', text: joinLines(paragraph) })

    paragraph = []
  }

  for (const raw of text.split('\n')) {
    const line = raw.trim()

    if (!line) {
      flush()
    } else if (/^=+$/.test(line)) {
      const title = paragraph.splice(0)

      flush()

      if (title.length) blocks.push({ kind: 'heading', text: joinLines(title) })
    } else if (/^-{5,}$/.test(line)) {
      flush()
      blocks.push({ kind: 'rule' })
    } else {
      paragraph.push(line)
    }
  }

  flush()

  // Collapse the doubled rules that frame a title ("---\nWordNet 3.0\n---").
  return blocks.filter((b, i) => !(b.kind === 'rule' && blocks[i - 1]?.kind === 'rule'))
}
