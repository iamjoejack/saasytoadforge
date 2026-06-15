/** Tiny class-name combiner. Falsy parts are dropped; truthy parts joined by spaces. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}
