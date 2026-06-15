/** Pull the hostname out of a URL (with or without a scheme). */
export function hostFromUrl(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    try {
      return new URL(`http://${url}`).hostname
    } catch {
      return ''
    }
  }
}

/**
 * Default-deny egress check. A host is allowed only if it exactly matches an allowlist
 * entry or is a subdomain of one. An empty allowlist blocks everything.
 */
export function isDomainAllowed(host: string, allowlist: string[]): boolean {
  if (!host) return false
  return allowlist.some((domain) => host === domain || host.endsWith(`.${domain}`))
}
