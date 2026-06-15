export class PathError extends Error {
  constructor(path: string) {
    super(`unsafe path: ${path}`)
    this.name = 'PathError'
  }
}

/**
 * Normalizes a client-supplied path to a workspace-relative path and rejects any
 * attempt to escape the workspace root. Filesystem access is scoped to the active
 * sandbox workspace only (see SECURITY in ARCHITECTURE.md, mission section 10).
 */
export function assertSafePath(path: string): string {
  const normalized = path
    .replace(/\\/g, '/')
    .replace(/^\.?\/+/, '')
    .replace(/\/+/g, '/')

  if (normalized === '' || normalized.split('/').some((seg) => seg === '..')) {
    throw new PathError(path)
  }
  return normalized
}
