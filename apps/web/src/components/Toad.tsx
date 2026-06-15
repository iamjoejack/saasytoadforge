/** Ronald SaaSyToad - the agent mascot. A small, geometric brass-on-green toad. */
export function Toad({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      role="img"
      aria-label="Ronald SaaSyToad"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <ellipse cx="32" cy="40" rx="22" ry="18" fill="#3f5d3a" />
      <ellipse cx="32" cy="46" rx="15" ry="10" fill="#557a4a" />
      <circle cx="20" cy="22" r="9" fill="#3f5d3a" />
      <circle cx="44" cy="22" r="9" fill="#3f5d3a" />
      <circle cx="20" cy="22" r="5" fill="#0a0a0b" />
      <circle cx="44" cy="22" r="5" fill="#0a0a0b" />
      <circle cx="21.5" cy="20.5" r="1.6" fill="#c8a24a" />
      <circle cx="45.5" cy="20.5" r="1.6" fill="#c8a24a" />
      <path d="M22 44 q10 7 20 0" stroke="#c8a24a" strokeWidth="2.2" strokeLinecap="round" />
      <rect x="29" y="8" width="6" height="9" rx="2" fill="#b56a3a" />
      <circle cx="32" cy="7" r="3" fill="#c8a24a" />
    </svg>
  )
}
