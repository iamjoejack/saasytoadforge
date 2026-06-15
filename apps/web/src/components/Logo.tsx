import { cn } from '@/lib/cn'

/** Company brand art, copied from the SaaSyToad company build. Single source of truth. */
export const LOGO_SRC = '/brand/saasytoad-logo.png'
export const LOGO_FULL_SRC = '/brand/saasytoad-logo-full.png'

/**
 * The SaaSyToad company mark. Use this for product chrome (headers, auth, footers) so
 * Forge stays brand-consistent with the rest of the ecosystem. The Ronald avatar
 * (`<Toad />`) stays for the in-app agent mascot.
 *
 * Server- or client-safe (no "use client").
 */
export function Logo({
  className,
  markClassName,
  wordmark = 'Forge',
  showWordmark = true,
  markSize = 22,
}: {
  className?: string
  markClassName?: string
  wordmark?: string
  showWordmark?: boolean
  markSize?: number
}) {
  return (
    <span className={cn('inline-flex items-center gap-2 select-none', className)}>
      <img
        src={LOGO_SRC}
        alt="SaaSyToad"
        width={markSize}
        height={markSize}
        style={{ width: markSize, height: markSize }}
        className={cn('rounded-md shadow-sm', markClassName)}
        draggable={false}
      />
      {showWordmark && (
        <span className="font-cinzel text-sm font-semibold tracking-tight text-white">{wordmark}</span>
      )}
    </span>
  )
}
