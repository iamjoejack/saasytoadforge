/**
 * Fuzzy search/replace edit applier.
 *
 * Whole-file overwrite is the least reliable way for a model to edit code: it must
 * reproduce the entire file every time and silently drops sections on long files. The
 * harness research is consistent that a search/replace edit format with a forgiving
 * applier is the single biggest reliability win available, roughly an order of magnitude
 * fewer edit errors than rigid matching. This module is that applier.
 *
 * It matches the model's `search` text against the file with progressively looser
 * strategies and never relies on line numbers, which models get wrong:
 *   1. exact substring (verbatim, also catches intra-line changes)
 *   2. trailing-whitespace-insensitive, line by line
 *   3. indentation-flexible, with relative re-indentation of the replacement
 */

export interface EditBlock {
  /** The exact text to find. Empty means create the file, or append when it already exists. */
  search: string
  /** The text to put in its place. */
  replace: string
}

export type ApplyStrategy = 'create' | 'append' | 'exact' | 'trim-trailing' | 'reindent'

export type ApplyResult =
  | { ok: true; contents: string; strategy: ApplyStrategy }
  | { ok: false; reason: string }

function splitLines(text: string): string[] {
  return text.split('\n')
}

/** Drop a single trailing blank line so a trailing newline in the block is not required to match. */
function dropTrailingBlank(lines: string[]): string[] {
  if (lines.length > 1 && lines[lines.length - 1] === '') return lines.slice(0, -1)
  return lines
}

const trimEnd = (s: string): string => s.replace(/\s+$/, '')

/** Longest common leading-whitespace prefix across the non-empty lines. */
function commonIndent(lines: string[]): string {
  let prefix: string | null = null
  for (const line of lines) {
    if (line.trim() === '') continue
    const indent = line.slice(0, line.length - line.trimStart().length)
    if (prefix === null) {
      prefix = indent
      continue
    }
    let i = 0
    while (i < prefix.length && i < indent.length && prefix[i] === indent[i]) i++
    prefix = prefix.slice(0, i)
  }
  return prefix ?? ''
}

/** Re-indent a replacement block written against `fromIndent` to sit at `toIndent`. */
function reindent(lines: string[], fromIndent: string, toIndent: string): string[] {
  if (fromIndent === toIndent) return lines
  return lines.map((line) => {
    if (line.trim() === '') return line
    if (fromIndent && line.startsWith(fromIndent)) return toIndent + line.slice(fromIndent.length)
    return toIndent + line
  })
}

/** First start index where every search line matches the file under `eq`, or -1. */
function findWindow(
  contentLines: string[],
  searchLines: string[],
  eq: (a: string, b: string) => boolean,
): number {
  if (searchLines.length === 0) return -1
  for (let start = 0; start + searchLines.length <= contentLines.length; start++) {
    let all = true
    for (let k = 0; k < searchLines.length; k++) {
      if (!eq(contentLines[start + k] ?? '', searchLines[k] ?? '')) {
        all = false
        break
      }
    }
    if (all) return start
  }
  return -1
}

/** Apply a single search/replace block to `content`, trying progressively looser matches. */
export function applyEdit(content: string, block: EditBlock): ApplyResult {
  const { search, replace } = block

  // Empty search: create the file, or append when it already has content.
  if (search === '') {
    if (content === '') return { ok: true, contents: replace, strategy: 'create' }
    const sep = content.endsWith('\n') ? '' : '\n'
    return { ok: true, contents: `${content}${sep}${replace}`, strategy: 'append' }
  }

  // 1) Exact substring: preserves everything verbatim and catches intra-line edits. Require a
  //    unique match so we never silently edit the wrong occurrence.
  const idx = content.indexOf(search)
  if (idx !== -1) {
    if (content.indexOf(search, idx + 1) !== -1) {
      return {
        ok: false,
        reason:
          'search block matches more than once. Add a few surrounding lines so it identifies exactly one place.',
      }
    }
    return {
      ok: true,
      contents: content.slice(0, idx) + replace + content.slice(idx + search.length),
      strategy: 'exact',
    }
  }

  const contentLines = splitLines(content)
  const searchLines = dropTrailingBlank(splitLines(search))
  const replaceLines = dropTrailingBlank(splitLines(replace))

  // 2) Trailing-whitespace-insensitive. Leading indent still matches, so use the replacement verbatim.
  let start = findWindow(contentLines, searchLines, (a, b) => trimEnd(a) === trimEnd(b))
  if (start !== -1) {
    const next = [
      ...contentLines.slice(0, start),
      ...replaceLines,
      ...contentLines.slice(start + searchLines.length),
    ]
    return { ok: true, contents: next.join('\n'), strategy: 'trim-trailing' }
  }

  // 3) Indentation-flexible: match on trimmed text, then re-indent the replacement from the
  //    search block's indentation to the file block's actual indentation.
  start = findWindow(contentLines, searchLines, (a, b) => a.trim() === b.trim())
  if (start !== -1) {
    const matched = contentLines.slice(start, start + searchLines.length)
    const reindented = reindent(replaceLines, commonIndent(searchLines), commonIndent(matched))
    const next = [
      ...contentLines.slice(0, start),
      ...reindented,
      ...contentLines.slice(start + searchLines.length),
    ]
    return { ok: true, contents: next.join('\n'), strategy: 'reindent' }
  }

  const firstLine = trimEnd(searchLines[0] ?? '').slice(0, 60)
  return {
    ok: false,
    reason: `search block not found (starting "${firstLine}"). Re-read the file and copy the exact text to change.`,
  }
}

/** Apply edits in order, threading each result into the next. Stops at the first failure. */
export function applyEdits(content: string, blocks: EditBlock[]): ApplyResult {
  let current = content
  let lastStrategy: ApplyStrategy = 'exact'
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]
    if (!block) continue
    const result = applyEdit(current, block)
    if (!result.ok) return { ok: false, reason: `edit ${i + 1}: ${result.reason}` }
    current = result.contents
    lastStrategy = result.strategy
  }
  return { ok: true, contents: current, strategy: lastStrategy }
}
