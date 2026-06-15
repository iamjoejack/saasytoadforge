/**
 * Company owner emails. Owners bypass spend caps, have unlimited agent access, and are
 * the only accounts that can create or remove admin users.
 *
 * This is the default list used by the env schema and the UI. Server-side enforcement
 * also honors the OWNER_EMAILS env var, which overrides this when set. No secrets here:
 * knowing an owner email grants nothing without that owner's password.
 */
export const OWNER_EMAILS: readonly string[] = [
  'joejackson80@gmail.com',
  'happyvwdude@gmail.com',
  'mojavenouveaux@gmail.com',
]

/** Case-insensitive owner check against the default owner list. */
export function isOwnerEmailDefault(email: string | null | undefined): boolean {
  if (!email) return false
  const normalized = email.trim().toLowerCase()
  return OWNER_EMAILS.some((owner) => owner.toLowerCase() === normalized)
}
