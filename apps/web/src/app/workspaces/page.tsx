'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import * as client from '@/lib/forge-client'
import type { Workspace } from '@/lib/forge-client'
import { Toad } from '@/components/Toad'

function WorkspaceSkeleton() {
  return (
    <div className="space-y-3.5">
      {[1, 2, 3].map((n) => (
        <div key={n} className="h-16 w-full rounded-xl shimmer border border-white/5 opacity-60" />
      ))}
    </div>
  )
}

export default function WorkspacesPage() {
  const router = useRouter()
  const [items, setItems] = useState<Workspace[] | null>(null)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [email, setEmail] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    client
      .listWorkspaces()
      .then((ws) => active && setItems(ws))
      .catch(() => active && setItems([]))
    fetch('/api/auth/session')
      .then((r) => r.json())
      .then((d: { user?: { email: string } | null }) => active && setEmail(d.user?.email ?? null))
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  async function signOut() {
    await fetch('/api/auth/signout', { method: 'POST' })
    router.push('/signin')
    router.refresh()
  }

  async function create() {
    setCreating(true)
    setError(null)
    try {
      const ws = await client.createWorkspace()
      router.push(`/workspaces/${ws.id}`)
    } catch {
      setError('Could not create a workspace. Is the agent service running?')
      setCreating(false)
    }
  }

  async function remove(id: string) {
    setItems((current) => (current ?? []).filter((w) => w.id !== id))
    await client.deleteWorkspace(id).catch(() => {})
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col px-6 py-16 animate-slide-up">
      {/* Header section info */}
      <div className="mb-6 flex items-center justify-between text-xs text-zinc-500 border-b border-white/5 pb-4">
        <span className="inline-flex items-center gap-2">
          <Link href="/settings" className="transition hover:text-zinc-300">
            settings
          </Link>
          <span className="text-zinc-700">|</span>
          <Link href="/pricing" className="transition hover:text-zinc-300">
            pricing & plans
          </Link>
        </span>
        {email ? (
          <span className="inline-flex items-center gap-3">
            <span>signed in as <strong className="text-zinc-400 font-medium">{email}</strong></span>
            <button type="button" onClick={() => void signOut()} className="transition hover:text-zinc-300 cursor-pointer">
              sign out
            </button>
          </span>
        ) : null}
      </div>

      <div className="flex items-center gap-3.5">
        <Toad className="h-9 w-9 shadow-md shadow-black/40 ring-1 ring-[var(--brass)]/20" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Workspaces</h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            Isolated code-execution sandboxes
          </p>
        </div>
        <button
          type="button"
          onClick={() => void create()}
          disabled={creating}
          className="ml-auto rounded-lg bg-[var(--brass)] px-4 py-2 text-sm font-semibold text-black transition hover:brightness-110 disabled:opacity-60 flex items-center gap-2 cursor-pointer shadow-lg shadow-[var(--brass)]/10"
        >
          {creating ? (
            <>
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-black border-t-transparent" />
              <span>Creating...</span>
            </>
          ) : (
            'New workspace'
          )}
        </button>
      </div>

      {error ? (
        <div className="mt-6 rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      ) : null}

      <div className="mt-8 space-y-3">
        {items === null ? (
          <WorkspaceSkeleton />
        ) : items.length === 0 ? (
          <p className="rounded-xl border border-dashed border-white/10 px-4 py-12 text-center text-sm text-zinc-500 bg-white/[0.01]">
            No workspaces yet. Create your first sandbox to get started.
          </p>
        ) : (
          items.map((ws) => (
            <div
              key={ws.id}
              className="flex items-center gap-4 rounded-xl px-5 py-4 transition-all duration-200 glass-panel glass-panel-hover"
            >
              {/* Pulsing Emerald status indicator badge */}
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              
              <div className="flex flex-col min-w-0 flex-1">
                <Link
                  href={`/workspaces/${ws.id}`}
                  className="font-mono text-sm font-medium text-zinc-200 transition hover:text-[var(--brass)] truncate"
                >
                  {ws.id}
                </Link>
                <span className="text-[11px] text-zinc-500 mt-1">
                  Created {new Date(ws.createdAt).toLocaleString()}
                </span>
              </div>
              
              <button
                type="button"
                onClick={() => void remove(ws.id)}
                className="text-xs font-semibold text-zinc-500 transition hover:text-red-400 cursor-pointer border border-transparent hover:border-red-500/20 hover:bg-red-500/5 px-2.5 py-1 rounded-md"
              >
                delete
              </button>
            </div>
          ))
        )}
      </div>
    </main>
  )
}
