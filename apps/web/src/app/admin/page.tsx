'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import * as client from '@/lib/forge-client'
import type { Workspace } from '@/lib/forge-client'
import { Toad } from '@/components/Toad'

interface AdminStats {
  workspaces: Workspace[]
  globalSpend: number
  caps: { perUserUsd: number; globalUsd: number }
  users: Array<{ userId: string; usd: number }>
}

export default function AdminPage() {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [authChecking, setAuthChecking] = useState(true)
  const [authorized, setAuthorized] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    // 1. Verify user role
    fetch('/api/auth/session')
      .then((r) => r.json())
      .then((d: { user?: { email: string; isAdmin?: boolean } | null }) => {
        if (!active) return
        setAuthChecking(false)
        if (d.user && d.user.isAdmin) {
          setAuthorized(true)
          
          // 2. Fetch stats
          client
            .getAdminStats()
            .then((res) => {
              if (active) {
                setStats(res)
                setLoading(false)
              }
            })
            .catch((_err) => {
              if (active) {
                setError('Failed to load admin statistics. Is the agent-service running?')
                setLoading(false)
              }
            })
        } else {
          setAuthorized(false)
          setLoading(false)
        }
      })
      .catch(() => {
        if (active) {
          setAuthChecking(false)
          setAuthorized(false)
          setLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [])

  if (authChecking) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-[var(--background)] px-6">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-700 border-t-[var(--brass)]" />
        <p className="mt-3 text-xs text-zinc-500 font-mono">Verifying credentials...</p>
      </div>
    )
  }

  if (!authorized) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-[var(--background)] px-6 relative overflow-hidden text-center">
        <div className="circuit-grid" />
        <div className="relative z-10 glass-panel p-8 rounded-2xl max-w-sm border-red-500/20 shadow-2xl">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 text-red-400 border border-red-500/20 mb-4 text-xl" />
          <h1 className="font-cinzel text-lg font-bold text-white mb-2">Access Denied</h1>
          <p className="text-xs text-zinc-400 leading-relaxed mb-6">
            This sector is restricted to administrators. If you believe this is an error, please ensure your email is added to the allowed administrator list.
          </p>
          <Link
            href="/dashboard"
            className="rounded-lg bg-zinc-800 border border-zinc-750 px-4 py-2 text-xs font-semibold text-zinc-200 transition hover:bg-zinc-700"
          >
            ← Return to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  const pctSpend = stats ? Math.min(100, (stats.globalSpend / stats.caps.globalUsd) * 100) : 0

  return (
    <div className="relative min-h-dvh bg-[var(--background)] py-12 px-6 overflow-hidden">
      <div className="circuit-grid" />

      <main className="relative z-10 mx-auto max-w-5xl animate-slide-up">
        {/* Header */}
        <header className="mb-10 flex items-center justify-between border-b border-white/5 pb-6">
          <div className="flex items-center gap-3">
            <Toad className="h-10 w-10 shadow-md shadow-black/40 ring-1 ring-amber-500/20" />
            <div>
              <h1 className="font-cinzel text-xl font-bold tracking-wider text-amber-500">Forge Admin Control</h1>
              <p className="text-xs text-zinc-500 uppercase tracking-widest mt-0.5">Platform Monitoring Engine</p>
            </div>
          </div>
          
          <Link
            href="/dashboard"
            className="rounded-lg border border-zinc-750 hover:bg-zinc-800 px-4 py-2 text-xs font-semibold text-zinc-200 transition"
          >
            ← Back to Dashboard
          </Link>
        </header>

        {error && (
          <div className="mb-8 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-700 border-t-amber-500" />
            <p className="mt-3 text-xs text-zinc-500 font-mono">Reading platform metrics...</p>
          </div>
        ) : stats ? (
          <div className="space-y-8">
            
            {/* Global spend steam gauge metrics */}
            <section className="glass-panel riveted rivet-bottom p-6 rounded-2xl shadow-xl">
              <h2 className="font-cinzel text-sm font-bold uppercase tracking-wider text-zinc-400 mb-4">
                Global Platform Consumption Gauge
              </h2>
              <div className="grid gap-6 md:grid-cols-3 items-center">
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Active spend</span>
                  <div className="text-3xl font-mono font-bold text-amber-500">
                    ${stats.globalSpend.toFixed(4)}
                  </div>
                </div>
                
                <div className="md:col-span-2 space-y-2">
                  <div className="flex justify-between text-xs font-mono text-zinc-400">
                    <span>Consumption level</span>
                    <span>Cap: ${stats.caps.globalUsd.toFixed(2)}</span>
                  </div>
                  <div className="h-4 w-full bg-zinc-950/60 rounded-lg overflow-hidden border border-white/5 p-0.5">
                    <div
                      style={{ width: `${pctSpend}%` }}
                      className="h-full bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-500 rounded-md transition-all duration-300"
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* Grid of Users and Active Workspaces */}
            <div className="grid gap-8 md:grid-cols-[280px_1fr]">
              {/* Users consumption list */}
              <section className="glass-panel riveted rivet-bottom p-5 rounded-xl shadow-lg h-fit">
                <h2 className="font-cinzel text-xs font-bold uppercase tracking-wider text-zinc-300 mb-4 border-b border-white/5 pb-2">
                  User Consumption Log
                </h2>
                
                {stats.users.length === 0 ? (
                  <p className="text-xs text-zinc-500 py-4 font-mono text-center">No spends recorded.</p>
                ) : (
                  <div className="space-y-3">
                    {stats.users.map((u) => (
                      <div key={u.userId} className="flex justify-between items-center text-xs font-mono border-b border-white/5 pb-2 last:border-0">
                        <span className="text-zinc-400 truncate max-w-[140px]" title={u.userId}>
                          {u.userId.slice(0, 8)}...
                        </span>
                        <span className="font-bold text-zinc-200">
                          ${u.usd.toFixed(4)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Active workspaces list */}
              <section className="glass-panel riveted rivet-bottom p-5 rounded-xl shadow-lg">
                <h2 className="font-cinzel text-xs font-bold uppercase tracking-wider text-zinc-300 mb-4 border-b border-white/5 pb-2">
                  Active Sandbox Clusters ({stats.workspaces.length})
                </h2>

                {stats.workspaces.length === 0 ? (
                  <p className="text-xs text-zinc-500 py-8 font-mono text-center">No active sandboxes on the platform.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs font-mono">
                      <thead>
                        <tr className="border-b border-white/10 text-zinc-500">
                          <th className="py-2 pr-4 font-semibold">Sandbox Cluster ID</th>
                          <th className="py-2 px-4 font-semibold">Tenant Owner ID</th>
                          <th className="py-2 pl-4 font-semibold">Boot Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats.workspaces.map((w) => (
                          <tr key={w.id} className="border-b border-white/5 text-zinc-300 hover:bg-white/[0.01]">
                            <td className="py-2.5 pr-4 text-[var(--brass)] truncate max-w-[180px]" title={w.id}>
                              {w.id}
                            </td>
                            <td className="py-2.5 px-4 text-zinc-400 truncate max-w-[140px]" title={w.owner}>
                              {w.owner.slice(0, 10)}...
                            </td>
                            <td className="py-2.5 pl-4 text-zinc-500">
                              {new Date(w.createdAt).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </div>
            
          </div>
        ) : null}
      </main>
    </div>
  )
}
