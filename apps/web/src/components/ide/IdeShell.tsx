'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { useIde } from '@/lib/store'
import { Toad } from '@/components/Toad'
import { FileTree } from './FileTree'
import { EditorPane } from './EditorPane'
import { TerminalPane } from './TerminalPane'
import { AgentPanel } from './AgentPanel'

export function IdeShell({ workspaceId }: { workspaceId: string }) {
  const setWorkspace = useIde((s) => s.setWorkspace)

  useEffect(() => {
    setWorkspace(workspaceId)
  }, [workspaceId, setWorkspace])

  return (
    <div className="grid h-dvh grid-rows-[auto_1fr] bg-[var(--background)] text-zinc-200">
      <header className="flex items-center gap-3 border-b border-white/5 px-4 py-2">
        <Link href="/" className="flex items-center gap-2">
          <Toad className="h-5 w-5" />
          <span className="text-sm font-semibold tracking-tight text-white">Forge</span>
        </Link>
        <span className="text-zinc-600">/</span>
        <Link href="/workspaces" className="text-sm text-zinc-400 transition hover:text-zinc-200">
          workspaces
        </Link>
        <span className="text-zinc-600">/</span>
        <span className="font-mono text-xs text-zinc-500" title={workspaceId}>
          {workspaceId.slice(0, 14)}
        </span>
        <span className="ml-auto inline-flex items-center gap-1.5 text-xs text-zinc-500">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          sandbox live
        </span>
      </header>

      <div className="grid min-h-0 grid-cols-[240px_1fr_360px]">
        <aside className="min-h-0 border-r border-white/5 bg-[#0c0c0e]">
          <FileTree workspaceId={workspaceId} />
        </aside>

        <section className="grid min-h-0 grid-rows-[1fr_220px]">
          <div className="min-h-0">
            <EditorPane />
          </div>
          <div className="min-h-0 border-t border-white/5">
            <TerminalPane workspaceId={workspaceId} />
          </div>
        </section>

        <aside className="min-h-0 border-l border-white/5">
          <AgentPanel workspaceId={workspaceId} />
        </aside>
      </div>
    </div>
  )
}
