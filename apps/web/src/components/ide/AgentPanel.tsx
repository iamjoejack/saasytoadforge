'use client'

import { Toad } from '@/components/Toad'

/**
 * Agent panel. Phase 1 ships the shell and an honest empty state; the live
 * plan -> edit -> run loop and artifacts arrive in Phase 2.
 */
export function AgentPanel() {
  return (
    <div className="flex h-full flex-col bg-[#0c0c0e]">
      <div className="flex items-center gap-2 border-b border-white/5 px-3 py-2">
        <Toad className="h-5 w-5" />
        <span className="text-[13px] font-medium text-zinc-200">Ronald</span>
        <span className="ml-auto rounded-full bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-wider text-zinc-500">
          Phase 2
        </span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 text-center">
        <Toad className="h-16 w-16 opacity-90" />
        <p className="mt-4 text-sm text-zinc-300">Describe a task and Ronald takes it from here.</p>
        <p className="mt-2 text-xs leading-relaxed text-zinc-500">
          Plan, edits, test runs, and screenshots will show up here as reviewable artifacts. The
          live agent loop lands in the next phase.
        </p>
      </div>

      <div className="border-t border-white/5 p-3">
        <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/30 px-3 py-2">
          <input
            disabled
            placeholder="Describe a task (available in Phase 2)"
            className="w-full bg-transparent text-sm text-zinc-300 placeholder:text-zinc-600 focus:outline-none disabled:cursor-not-allowed"
          />
          <button
            type="button"
            disabled
            className="rounded-md bg-[var(--brass)]/40 px-3 py-1 text-xs font-medium text-black/70"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}
