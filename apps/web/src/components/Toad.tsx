import { cn } from '@/lib/cn'

/** Ronald SaaSyToad - the agent mascot. Steampunk toad art, rendered as a round avatar. */
export function Toad({ className }: { className?: string }) {
  // Local asset in /public; plain img keeps the simple className-based sizing API.
  return (
    <img
      src="/ronald.png"
      alt="Ronald SaaSyToad"
      className={cn('rounded-full object-cover', className)}
    />
  )
}
