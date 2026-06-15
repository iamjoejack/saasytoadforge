'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import * as client from '@/lib/forge-client'
import type { Workspace } from '@/lib/forge-client'
import { Toad } from '@/components/Toad'

export default function WorkspacesPage() {
  const router = useRouter()
  const [items, setItems] = useState<Workspace[] | null>(null)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    client
      .listWorkspaces()
      .then((ws) => active && setItems(ws))
      .catch(() => active && setItems([]))
    return () => {
      active = false
    }
  }, [])

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

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col px-6 py-16">
      <div className="flex items-center gap-3">
        <Toad className="h-8 w-8" />
        <h1 className="text-2xl font-semibold tracking-tight text-white">Workspaces</h1>
        <button
          type="button"
          onClick={() => void create()}
          disabled={creating}
          className="ml-auto rounded-md bg-[var(--brass)] px-4 py-2 text-sm font-semibold text-black transition hover:brightness-110 disabled:opacity-60"
        >
          {creating ? 'Creating...' : 'New workspace'}
        </button>
      </div>

      <p className="mt-2 text-sm text-zinc-500">
        Each workspace is one isolated sandbox. Open one to plan, edit, and run.
      </p>

      {error ? <p className="mt-4 text-sm text-red-400">{error}</p> : null}

      <div className="mt-8 space-y-2">
        {items === null ? (
          <p className="text-sm text-zinc-500">Loading...</p>
        ) : items.length === 0 ? (
          <p className="rounded-lg border border-dashed border-white/10 px-4 py-10 text-center text-sm text-zinc-500">
            No workspaces yet. Create your first one.
          </p>
        ) : (
          items.map((ws) => (
            <Link
              key={ws.id}
              href={`/workspaces/${ws.id}`}
              className="flex items-center gap-3 rounded-lg border border-white/10 px-4 py-3 transition hover:border-[var(--brass)]/40 hover:bg-white/5"
            >
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span className="font-mono text-sm text-zinc-200">{ws.id}</span>
              <span className="ml-auto text-xs text-zinc-600">
                {new Date(ws.createdAt).toLocaleString()}
              </span>
            </Link>
          ))
        )}
      </div>
    </main>
  )
}
