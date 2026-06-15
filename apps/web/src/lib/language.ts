/** Maps a file path to a Monaco language id. Defaults to plaintext. */
const BY_EXT: Readonly<Record<string, string>> = {
  ts: 'typescript',
  tsx: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  json: 'json',
  md: 'markdown',
  css: 'css',
  html: 'html',
  py: 'python',
  go: 'go',
  rs: 'rust',
  sh: 'shell',
  yml: 'yaml',
  yaml: 'yaml',
}

export function languageFor(path: string | null): string {
  if (!path) return 'plaintext'
  const ext = path.split('.').pop()?.toLowerCase() ?? ''
  return BY_EXT[ext] ?? 'plaintext'
}
