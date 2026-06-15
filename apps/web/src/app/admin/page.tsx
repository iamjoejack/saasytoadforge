'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { ConfigSummary } from '@forge/shared'
import { BACK_OFFICE_AREAS, type AdminRole, type AreaKey } from '@/lib/admin/permissions'
import * as client from '@/lib/forge-client'
import type { Workspace } from '@/lib/forge-client'
import { Logo } from '@/components/Logo'
import { cn } from '@/lib/cn'

interface AdminSession {
  email: string
  role: AdminRole
  permissions: AreaKey[]
}
interface AdminRecord {
  id: string
  email: string
  role: AdminRole
  permissions: AreaKey[]
  createdAt: string
}
interface Stats {
  workspaces: Workspace[]
  globalSpend: number
  caps: { perUserUsd: number; globalUsd: number }
  users: Array<{ userId: string; usd: number }>
}

type TabKey = 'users' | 'billing' | 'system' | 'content'

function can(session: AdminSession, area: AreaKey): boolean {
  return session.role === 'owner' || session.permissions.includes(area)
}

export default function AdminPage() {
  const router = useRouter()
  const [session, setSession] = useState<AdminSession | null>(null)
  const [checking, setChecking] = useState(true)
  const [tab, setTab] = useState<TabKey>('users')

  useEffect(() => {
    let active = true
    fetch('/api/admin/me')
      .then((r) => r.json())
      .then((d: { admin: AdminSession | null }) => {
        if (!active) return
        if (!d.admin) {
          router.replace('/admin/login')
          return
        }
        setSession(d.admin)
        setTab(d.admin.role === 'owner' || d.admin.permissions.includes('users') ? 'users' : (d.admin.permissions[0] ?? 'users'))
        setChecking(false)
      })
      .catch(() => active && router.replace('/admin/login'))
    return () => {
      active = false
    }
  }, [router])

  async function signOut() {
    await fetch('/api/admin/logout', { method: 'POST' })
    router.push('/admin/login')
    router.refresh()
  }

  if (checking || !session) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-[var(--background)] px-6">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-700 border-t-[var(--brass)]" />
        <p className="mt-3 text-xs text-zinc-500 font-mono">Checking your access...</p>
      </div>
    )
  }

  const allTabs: Array<{ key: TabKey; label: string }> = [
    { key: 'users', label: 'Admins and access' },
    { key: 'billing', label: 'Billing and usage' },
    { key: 'system', label: 'System' },
    { key: 'content', label: 'Product status' },
  ]
  const tabs = allTabs.filter((t) => can(session, t.key))

  return (
    <div className="relative min-h-dvh bg-[var(--background)] py-12 px-6 overflow-hidden">
      <div className="circuit-grid" />
      <main className="relative z-10 mx-auto max-w-5xl animate-slide-up">
        <header className="mb-8 flex items-center justify-between border-b border-white/5 pb-6">
          <div className="flex items-center gap-3">
            <Logo wordmark="Forge" markSize={34} showWordmark={false} />
            <div>
              <h1 className="font-cinzel text-xl font-bold tracking-wider text-white">Owner console</h1>
              <p className="text-xs text-zinc-500 mt-0.5">
                Signed in as {session.email}
                <span
                  className={cn(
                    'ml-2 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                    session.role === 'owner'
                      ? 'border-[var(--brass)]/30 bg-[var(--brass)]/10 text-[var(--brass)]'
                      : 'border-sky-500/30 bg-sky-500/10 text-sky-400',
                  )}
                >
                  {session.role}
                </span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/dashboard" className="rounded-lg border border-zinc-750 hover:bg-zinc-800 px-3 py-2 text-xs font-semibold text-zinc-300 transition">
              App dashboard
            </Link>
            <button type="button" onClick={() => void signOut()} className="rounded-lg border border-red-500/20 bg-red-500/5 hover:bg-red-500/15 px-3 py-2 text-xs font-semibold text-red-400 transition cursor-pointer">
              Sign out
            </button>
          </div>
        </header>

        <div className="mb-6 flex flex-wrap gap-1.5">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-semibold border transition cursor-pointer',
                tab === t.key
                  ? 'border-[var(--brass)]/30 bg-[var(--brass)]/10 text-[var(--brass)]'
                  : 'border-transparent text-zinc-400 hover:bg-white/[0.03] hover:text-zinc-200',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'users' && <AdminsTab session={session} />}
        {tab === 'billing' && <BillingTab />}
        {tab === 'system' && <SystemTab />}
        {tab === 'content' && <ProductTab />}
      </main>
    </div>
  )
}

// ── Admins and access ────────────────────────────────────────────────────────
function AdminsTab({ session }: { session: AdminSession }) {
  const isOwner = session.role === 'owner'
  const [admins, setAdmins] = useState<AdminRecord[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [perms, setPerms] = useState<AreaKey[]>([])
  const [creating, setCreating] = useState(false)

  const load = useCallback(() => {
    fetch('/api/admin/admins')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('forbidden'))))
      .then((d: { admins: AdminRecord[] }) => setAdmins(d.admins))
      .catch(() => setAdmins([]))
  }, [])
  useEffect(load, [load])

  async function createAdmin() {
    setError(null)
    setCreating(true)
    try {
      const res = await fetch('/api/admin/admins', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password, permissions: perms }),
      })
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        setError(body.error ?? 'Could not create admin.')
      } else {
        setEmail('')
        setPassword('')
        setPerms([])
        load()
      }
    } finally {
      setCreating(false)
    }
  }

  async function togglePerm(a: AdminRecord, area: AreaKey) {
    const next = a.permissions.includes(area) ? a.permissions.filter((p) => p !== area) : [...a.permissions, area]
    const res = await fetch(`/api/admin/admins/${a.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ permissions: next }),
    })
    if (res.ok) load()
  }

  async function remove(a: AdminRecord) {
    if (!window.confirm(`Remove admin ${a.email}?`)) return
    const res = await fetch(`/api/admin/admins/${a.id}`, { method: 'DELETE' })
    if (res.ok) load()
  }

  return (
    <div className="space-y-6">
      {isOwner && (
        <section className="glass-panel p-5 rounded-xl">
          <h2 className="font-cinzel text-sm font-bold text-zinc-200 mb-1">Add an admin</h2>
          <p className="text-[11px] text-zinc-550 mb-4">Only you, an owner, can add admins. You set their password and exactly what they can see.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin email" type="email" className="rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-xs text-zinc-200 placeholder:text-zinc-600 focus:border-[var(--brass)]/50 focus:outline-none" />
            <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="set a password (8+ chars)" type="password" className="rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-xs text-zinc-200 placeholder:text-zinc-600 focus:border-[var(--brass)]/50 focus:outline-none" />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {BACK_OFFICE_AREAS.map((area) => (
              <button
                key={area.key}
                type="button"
                onClick={() => setPerms((p) => (p.includes(area.key) ? p.filter((x) => x !== area.key) : [...p, area.key]))}
                title={area.desc}
                className={cn(
                  'rounded-lg border px-2.5 py-1 text-[11px] font-medium transition cursor-pointer',
                  perms.includes(area.key) ? 'border-[var(--brass)]/40 bg-[var(--brass)]/10 text-[var(--brass)]' : 'border-white/10 text-zinc-400 hover:text-zinc-200',
                )}
              >
                {area.label}
              </button>
            ))}
          </div>
          {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
          <div className="mt-4 flex justify-end">
            <button type="button" disabled={creating || !email || !password} onClick={() => void createAdmin()} className="rounded-lg bg-[var(--brass)] text-black px-4 py-2 text-xs font-bold transition hover:brightness-110 disabled:opacity-40 cursor-pointer">
              {creating ? 'Adding...' : 'Add admin'}
            </button>
          </div>
        </section>
      )}

      <section className="glass-panel p-5 rounded-xl">
        <h2 className="font-cinzel text-sm font-bold text-zinc-200 mb-4">Admins</h2>
        {admins === null ? (
          <p className="text-xs text-zinc-500">Loading...</p>
        ) : admins.length === 0 ? (
          <p className="text-xs text-zinc-500">No admins yet. Owners always have full access.</p>
        ) : (
          <div className="space-y-3">
            {admins.map((a) => (
              <div key={a.id} className="rounded-lg border border-white/5 bg-black/20 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-zinc-200 font-medium truncate">{a.email}</span>
                  {isOwner && (
                    <button type="button" onClick={() => void remove(a)} className="text-[11px] text-red-400 hover:text-red-300 transition cursor-pointer shrink-0">
                      Remove
                    </button>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {BACK_OFFICE_AREAS.map((area) => {
                    const on = a.permissions.includes(area.key)
                    return (
                      <button
                        key={area.key}
                        type="button"
                        disabled={!isOwner}
                        onClick={() => void togglePerm(a, area.key)}
                        title={area.desc}
                        className={cn(
                          'rounded border px-2 py-0.5 text-[10px] font-medium transition',
                          on ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' : 'border-white/10 text-zinc-550',
                          isOwner ? 'cursor-pointer hover:brightness-110' : 'cursor-default',
                        )}
                      >
                        {area.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
        {!isOwner && (
          <p className="mt-4 text-[11px] text-zinc-550">You can view admins. Only an owner can add, remove, or change access.</p>
        )}
      </section>
    </div>
  )
}

// ── Billing and usage ────────────────────────────────────────────────────────
function BillingTab() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/stats')
      .then(async (r) => {
        const d = await r.json()
        if (!r.ok) throw new Error(d.error ?? 'unavailable')
        setStats(d as Stats)
      })
      .catch((e: Error) => setError(e.message))
  }, [])

  if (error) return <div className="glass-panel p-5 rounded-xl text-xs text-amber-400">{error}</div>
  if (!stats) return <div className="glass-panel p-5 rounded-xl text-xs text-zinc-500">Loading platform metrics...</div>

  const pct = Math.min(100, (stats.globalSpend / stats.caps.globalUsd) * 100)
  return (
    <div className="space-y-6">
      <section className="glass-panel p-6 rounded-2xl">
        <h2 className="font-cinzel text-sm font-bold uppercase tracking-wider text-zinc-400 mb-4">Global spend</h2>
        <div className="grid gap-6 md:grid-cols-3 items-center">
          <div>
            <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Active spend</span>
            <div className="text-3xl font-mono font-bold text-[var(--brass)]">${stats.globalSpend.toFixed(4)}</div>
          </div>
          <div className="md:col-span-2 space-y-2">
            <div className="flex justify-between text-xs font-mono text-zinc-400">
              <span>Consumption</span>
              <span>Cap ${stats.caps.globalUsd.toFixed(2)}</span>
            </div>
            <div className="h-3 w-full bg-zinc-950/60 rounded-lg overflow-hidden border border-white/5 p-0.5">
              <div style={{ width: `${pct}%` }} className="h-full bg-gradient-to-r from-amber-600 to-yellow-500 rounded-md transition-all" />
            </div>
          </div>
        </div>
      </section>
      <section className="glass-panel p-5 rounded-xl">
        <h2 className="font-cinzel text-xs font-bold uppercase tracking-wider text-zinc-300 mb-4">Workspaces ({stats.workspaces.length})</h2>
        {stats.workspaces.length === 0 ? (
          <p className="text-xs text-zinc-500">No active sandboxes.</p>
        ) : (
          <div className="space-y-2 text-xs font-mono">
            {stats.workspaces.map((w) => (
              <div key={w.id} className="flex justify-between border-b border-white/5 pb-1.5 last:border-0">
                <span className="text-[var(--brass)] truncate max-w-[200px]">{w.id}</span>
                <span className="text-zinc-500">{new Date(w.createdAt).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

// ── System ───────────────────────────────────────────────────────────────────
function SystemTab() {
  const [config, setConfig] = useState<ConfigSummary | null>(null)
  useEffect(() => {
    client.getConfig().then(setConfig).catch(() => setConfig(null))
  }, [])
  if (!config) return <div className="glass-panel p-5 rounded-xl text-xs text-zinc-500">Loading config...</div>
  const secrets = config.secrets as Record<string, boolean>
  return (
    <div className="space-y-6">
      <section className="glass-panel p-5 rounded-xl">
        <h2 className="font-cinzel text-sm font-bold text-zinc-200 mb-4">Service</h2>
        <div className="grid gap-2 text-xs sm:grid-cols-2">
          <Row k="Sandbox provider" v={config.sandboxProvider} />
          <Row k="Per-user cap" v={`$${config.caps.perUserUsd.toFixed(2)}`} />
          <Row k="Global cap" v={`$${config.caps.globalUsd.toFixed(2)}`} />
        </div>
      </section>
      <section className="glass-panel p-5 rounded-xl">
        <h2 className="font-cinzel text-sm font-bold text-zinc-200 mb-4">Integrations</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {Object.entries(secrets).map(([name, on]) => (
            <div key={name} className="flex items-center justify-between text-xs border-b border-white/5 pb-1.5">
              <span className="text-zinc-400 capitalize">{name}</span>
              <span className={cn('font-bold', on ? 'text-emerald-400' : 'text-zinc-600')}>{on ? 'connected' : 'off'}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between border-b border-white/5 pb-1.5">
      <span className="text-zinc-500">{k}</span>
      <span className="text-zinc-200 font-mono">{v}</span>
    </div>
  )
}

// ── Product status ───────────────────────────────────────────────────────────
const STATUSES = [
  { key: 'coming-soon', label: 'Coming soon' },
  { key: 'early-access', label: 'Early access' },
  { key: 'live', label: 'Live' },
] as const

function ProductTab() {
  const [status, setStatus] = useState<string>('coming-soon')
  useEffect(() => {
    try {
      setStatus(localStorage.getItem('forge:product_status') ?? 'coming-soon')
    } catch {
      // ignore
    }
  }, [])
  function choose(s: string) {
    setStatus(s)
    try {
      localStorage.setItem('forge:product_status', s)
    } catch {
      // ignore
    }
  }
  return (
    <div className="space-y-6">
      <section className="glass-panel p-5 rounded-xl">
        <h2 className="font-cinzel text-sm font-bold text-zinc-200 mb-1">Forge launch status</h2>
        <p className="text-[11px] text-zinc-550 mb-4 leading-relaxed">
          Set how Forge is presented on the marketing site. This is the intended status; it appears on the marketing site on its next deploy.
        </p>
        <div className="flex flex-wrap gap-2">
          {STATUSES.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => choose(s.key)}
              className={cn(
                'rounded-lg border px-3 py-1.5 text-xs font-semibold transition cursor-pointer',
                status === s.key ? 'border-[var(--brass)]/40 bg-[var(--brass)]/10 text-[var(--brass)]' : 'border-white/10 text-zinc-400 hover:text-zinc-200',
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
        <p className="mt-4 text-[11px] text-zinc-550">
          Current selection: <span className="text-zinc-300 font-semibold">{STATUSES.find((s) => s.key === status)?.label}</span>.
          The marketing site reads this from its product config; flip it there and redeploy to publish.
        </p>
      </section>
    </div>
  )
}
