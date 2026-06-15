export interface DiffLine {
  tag: ' ' | '-' | '+'
  text: string
}

/** Line-level diff via an LCS table. Small files only (agent edits), which is fine here. */
export function diffLines(before: string, after: string): DiffLine[] {
  const a = before === '' ? [] : before.split('\n')
  const b = after === '' ? [] : after.split('\n')
  const m = a.length
  const n = b.length

  // dp[i*(n+1)+j] = LCS length of a[i:] and b[j:]
  const width = n + 1
  const dp = new Int32Array((m + 1) * width)
  const at = (k: number): number => dp[k] ?? 0
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i * width + j] =
        a[i] === b[j]
          ? at((i + 1) * width + (j + 1)) + 1
          : Math.max(at((i + 1) * width + j), at(i * width + (j + 1)))
    }
  }

  const out: DiffLine[] = []
  let i = 0
  let j = 0
  while (i < m && j < n) {
    if (a[i] === b[j]) {
      out.push({ tag: ' ', text: a[i] ?? '' })
      i++
      j++
    } else if (at((i + 1) * width + j) >= at(i * width + (j + 1))) {
      out.push({ tag: '-', text: a[i] ?? '' })
      i++
    } else {
      out.push({ tag: '+', text: b[j] ?? '' })
      j++
    }
  }
  while (i < m) {
    out.push({ tag: '-', text: a[i] ?? '' })
    i++
  }
  while (j < n) {
    out.push({ tag: '+', text: b[j] ?? '' })
    j++
  }
  return out
}

/** A git-style unified diff string for an edit artifact. */
export function unifiedDiff(path: string, before: string, after: string): string {
  const verb = before === '' ? 'new file' : 'modified'
  const header = `diff --forge ${verb} ${path}\n--- a/${path}\n+++ b/${path}`
  const body = diffLines(before, after)
    .map((line) => `${line.tag}${line.text}`)
    .join('\n')
  return `${header}\n${body}`
}
