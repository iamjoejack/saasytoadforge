'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import * as client from '@/lib/forge-client'
import type { Workspace } from '@/lib/forge-client'
import { Toad } from '@/components/Toad'
import { cn } from '@/lib/cn'

interface ExtensionItem {
  id: string
  name: string
  category: string
  description: string
  secretKey: string // mapped key in config.secrets
  icon: string
  command: string
  docUrl: string
}

const EXTENSIONS_CATALOG: ExtensionItem[] = [
  {
    id: 'supabase',
    name: 'Supabase Postgres & Auth',
    category: 'Database & Auth',
    description: 'PostgreSQL database, user authentication, row-level security, and real-time backend structures.',
    secretKey: 'supabase',
    icon: '⚡',
    command: 'stripe projects add supabase',
    docUrl: 'https://supabase.com/docs',
  },
  {
    id: 'e2b',
    name: 'E2B Sandboxes',
    category: 'Secure Code Execution',
    description: 'Secure, sandboxed browser and terminal execution microVM environments for AI agents.',
    secretKey: 'e2b',
    icon: '📦',
    command: 'stripe projects add e2b',
    docUrl: 'https://e2b.dev/docs',
  },
  {
    id: 'stripe',
    name: 'Stripe Billing',
    category: 'Billing & Subscriptions',
    description: 'Accept customer payments, manage subscriptions, and verify checkout webhooks.',
    secretKey: 'stripe',
    icon: '💳',
    command: 'stripe projects add stripe',
    docUrl: 'https://docs.stripe.com',
  },
  {
    id: 'upstash-redis',
    name: 'Upstash Redis Cache',
    category: 'Caching & Queues',
    description: 'Low-latency serverless Redis database for state storage, caching, and worker message queues.',
    secretKey: 'upstashRedis',
    icon: '🔴',
    command: 'stripe projects add upstash-redis',
    docUrl: 'https://upstash.com/docs',
  },
  {
    id: 'resend',
    name: 'Resend Email Service',
    category: 'Transactional Emails',
    description: 'Modern developer-friendly email API for sending notifications and transactional verification logs.',
    secretKey: 'resend',
    icon: '✉',
    command: 'stripe projects add resend',
    docUrl: 'https://resend.com/docs',
  },
  {
    id: 'vercel',
    name: 'Vercel Edge Hosting',
    category: 'Hosting & Functions',
    description: 'Deploy frontend apps and backend serverless endpoints instantly on the global edge CDN.',
    secretKey: 'vercel',
    icon: '▲',
    command: 'stripe projects add vercel',
    docUrl: 'https://vercel.com/docs',
  },
]

export default function DashboardPage() {
  const router = useRouter()
  const [items, setItems] = useState<Workspace[] | null>(null)
  const [config, setConfig] = useState<any | null>(null)
  const [activeTab, setActiveTab] = useState<'workspaces' | 'extensions'>('workspaces')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [email, setEmail] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  
  // Extension keys state
  const [anthropicKey, setAnthropicKey] = useState('')
  const [googleKey, setGoogleKey] = useState('')
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    client
      .listWorkspaces()
      .then((ws) => active && setItems(ws))
      .catch(() => active && setItems([]))
      
    client
      .getConfig()
      .then((cfg) => active && setConfig(cfg))
      .catch(() => {})
      
    fetch('/api/auth/session')
      .then((r) => r.json())
      .then((d: { user?: { email: string; isAdmin?: boolean } | null }) => {
        if (active && d.user) {
          setEmail(d.user.email)
          setIsAdmin(d.user.isAdmin ?? false)
        }
      })
      .catch(() => {})

    // Load saved extension keys
    try {
      const saved = localStorage.getItem('forge:custom_keys')
      if (saved) {
        const parsed = JSON.parse(saved)
        setAnthropicKey(parsed.anthropic || '')
        setGoogleKey(parsed.google || '')
      }
    } catch {
      // ignore
    }

    return () => {
      active = false
    }
  }, [])

  function saveKeys() {
    try {
      localStorage.setItem(
        'forge:custom_keys',
        JSON.stringify({
          anthropic: anthropicKey.trim(),
          google: googleKey.trim(),
        }),
      )
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch {
      setError('Failed to save keys to local storage.')
    }
  }

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

  function handleCopy(command: string, id: string) {
    void navigator.clipboard.writeText(command)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <div className="relative min-h-dvh bg-[var(--background)] py-12 px-6 overflow-hidden">
      {/* Steampunk blueprint circuit grid */}
      <div className="circuit-grid" />

      <main className="relative z-10 mx-auto max-w-5xl animate-slide-up">
        {/* Header */}
        <header className="mb-10 flex items-center justify-between border-b border-white/5 pb-6">
          <div className="flex items-center gap-3">
            <Toad className="h-10 w-10 shadow-md shadow-black/40 ring-1 ring-[var(--brass)]/20" />
            <div>
              <h1 className="font-cinzel text-xl font-bold tracking-wider text-white">ToadForge Dashboard</h1>
              <p className="text-xs text-zinc-500 uppercase tracking-widest mt-0.5">AI Engine & Workspace Bench</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4 text-xs text-zinc-400">
            {isAdmin && (
              <Link
                href="/admin"
                className="rounded-md bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 font-bold uppercase tracking-wider text-amber-500 hover:bg-amber-500/20 transition"
              >
                Admin Panel
              </Link>
            )}
            <span className="text-zinc-600">|</span>
            <span className="hidden sm:inline">signed in as <strong className="text-zinc-300 font-medium">{email}</strong></span>
            <button
              type="button"
              onClick={() => void signOut()}
              className="text-zinc-400 transition hover:text-red-400 cursor-pointer"
            >
              sign out
            </button>
          </div>
        </header>

        {error && (
          <div className="mb-8 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="grid gap-8 md:grid-cols-[1fr_360px]">
          {/* Left panel: Active Tab switch */}
          <div className="space-y-6">
            
            {/* Tab Switecher */}
            <div className="flex gap-2 border-b border-white/5 pb-3">
              <button
                type="button"
                onClick={() => setActiveTab('workspaces')}
                className={cn(
                  'px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition cursor-pointer',
                  activeTab === 'workspaces'
                    ? 'bg-zinc-800 text-[var(--brass)] border border-[var(--brass)]/30'
                    : 'text-zinc-400 hover:text-zinc-200'
                )}
              >
                Active Sandboxes
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('extensions')}
                className={cn(
                  'px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition cursor-pointer',
                  activeTab === 'extensions'
                    ? 'bg-zinc-800 text-[var(--brass)] border border-[var(--brass)]/30'
                    : 'text-zinc-400 hover:text-zinc-200'
                )}
              >
                Forge Extension Store
              </button>
            </div>

            {activeTab === 'workspaces' ? (
              <section className="glass-panel riveted rivet-bottom p-6 rounded-2xl shadow-xl">
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <h2 className="font-cinzel text-lg font-bold text-zinc-200">Active Workspaces</h2>
                    <p className="text-xs text-zinc-500 mt-0.5">Isolated developer sandboxes on E2B</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void create()}
                    disabled={creating}
                    className="rounded-lg bg-[var(--brass)] px-4 py-2 text-xs font-semibold text-black transition hover:brightness-110 disabled:opacity-60 flex items-center gap-1.5 cursor-pointer shadow-lg shadow-[var(--brass)]/10"
                  >
                    {creating ? (
                      <>
                        <span className="h-3 w-3 animate-spin rounded-full border border-black border-t-transparent" />
                        <span>Creating...</span>
                      </>
                    ) : (
                      'New workspace'
                    )}
                  </button>
                </div>

                <div className="space-y-3">
                  {items === null ? (
                    [1, 2].map((n) => (
                      <div key={n} className="h-16 w-full rounded-xl shimmer border border-white/5 opacity-55" />
                    ))
                  ) : items.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-white/10 px-4 py-12 text-center text-xs text-zinc-500 bg-white/[0.01]">
                      No sandboxes launched yet. Click &ldquo;New Workspace&rdquo; to boot your first workbench.
                    </div>
                  ) : (
                    items.map((ws) => (
                      <div
                        key={ws.id}
                        className="flex items-center justify-between gap-4 rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3.5 hover:border-[var(--brass)]/20 transition"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="relative flex h-2 w-2 shrink-0">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                          </span>
                          <Link
                            href={`/workspaces/${ws.id}`}
                            className="font-mono text-xs font-semibold text-zinc-300 hover:text-[var(--brass)] transition truncate"
                          >
                            {ws.id}
                          </Link>
                        </div>
                        <span className="text-[10px] text-zinc-600 font-mono hidden sm:inline">
                          {new Date(ws.createdAt).toLocaleDateString()}
                        </span>
                        <Link
                          href={`/workspaces/${ws.id}`}
                          className="text-xs font-bold text-[var(--brass)] hover:underline"
                        >
                          Enter Bench →
                        </Link>
                      </div>
                    ))
                  )}
                </div>
              </section>
            ) : (
              <section className="glass-panel riveted rivet-bottom p-6 rounded-2xl shadow-xl space-y-6">
                <div>
                  <h2 className="font-cinzel text-lg font-bold text-zinc-200">Forge Extension Store</h2>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Connect API services and platform tools. Link them using the Stripe Projects CLI tool below.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  {EXTENSIONS_CATALOG.map((ext) => {
                    const isConnected = config?.secrets?.[ext.secretKey] ?? false
                    const isCopied = copiedId === ext.id

                    return (
                      <div
                        key={ext.id}
                        className="flex flex-col rounded-xl border border-white/5 bg-white/[0.01] p-4 hover:border-white/10 transition justify-between"
                      >
                        <div>
                          <div className="flex items-start justify-between mb-2">
                            <span className="text-xl" role="img" aria-label={ext.name}>
                              {ext.icon}
                            </span>
                            <span
                              className={cn(
                                'rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide border',
                                isConnected
                                  ? 'bg-emerald-500/10 border-emerald-500/35 text-emerald-400'
                                  : 'bg-zinc-800/40 border-zinc-700 text-zinc-500'
                              )}
                            >
                              {isConnected ? 'Connected' : 'Available'}
                            </span>
                          </div>
                          
                          <h3 className="text-xs font-bold text-zinc-200">{ext.name}</h3>
                          <span className="text-[10px] text-[var(--brass)] font-semibold">{ext.category}</span>
                          <p className="text-[11px] text-zinc-400 mt-1.5 leading-relaxed">
                            {ext.description}
                          </p>
                        </div>

                        <div className="mt-4 pt-3 border-t border-white/5 space-y-2">
                          <div className="flex items-center justify-between gap-1 bg-black/40 rounded p-1.5 border border-white/5">
                            <code className="text-[10px] text-zinc-400 font-mono truncate select-all">
                              {ext.command}
                            </code>
                            <button
                              type="button"
                              onClick={() => handleCopy(ext.command, ext.id)}
                              className="text-[9px] text-[var(--brass)] hover:underline shrink-0 font-bold px-1.5 cursor-pointer"
                            >
                              {isCopied ? 'Copied!' : 'Copy'}
                            </button>
                          </div>
                          <a
                            href={ext.docUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block text-[10px] text-zinc-500 hover:text-zinc-300 font-semibold"
                          >
                            Read docs →
                          </a>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            )}

            {/* API settings section */}
            <section className="glass-panel riveted rivet-bottom p-6 rounded-2xl shadow-xl">
              <div className="mb-4">
                <h2 className="font-cinzel text-lg font-bold text-zinc-200">Developer API Extensions</h2>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Plug in your own API keys. When configured, agent requests will execute directly on your developer account keys (bypassing openrouter).
                </p>
              </div>

              {saveSuccess && (
                <div className="mb-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-2 text-xs text-emerald-400 font-semibold animate-fade-in">
                  ✓ Extensions config saved successfully in secure local storage.
                </div>
              )}

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-zinc-400 flex justify-between">
                    <span>Anthropic Claude API Key (sk-ant-...)</span>
                    {anthropicKey && <span className="text-[10px] text-emerald-500 font-bold uppercase tracking-wider">Active</span>}
                  </label>
                  <input
                    type="password"
                    value={anthropicKey}
                    onChange={(e) => setAnthropicKey(e.target.value)}
                    placeholder="Enter sk-ant-... key to activate direct Claude-3.5 routing"
                    className="w-full rounded-lg border border-white/10 bg-black/40 px-3.5 py-2 text-xs font-mono text-zinc-100 placeholder:text-zinc-600 focus:border-[var(--brass)]/50 focus:ring-1 focus:ring-[var(--brass)]/20 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-zinc-400 flex justify-between">
                    <span>Google Gemini API Key (AIzaSy...)</span>
                    {googleKey && <span className="text-[10px] text-emerald-500 font-bold uppercase tracking-wider">Active</span>}
                  </label>
                  <input
                    type="password"
                    value={googleKey}
                    onChange={(e) => setGoogleKey(e.target.value)}
                    placeholder="Enter AIzaSy... key to activate direct Gemini-2.5 routing"
                    className="w-full rounded-lg border border-white/10 bg-black/40 px-3.5 py-2 text-xs font-mono text-zinc-100 placeholder:text-zinc-600 focus:border-[var(--brass)]/50 focus:ring-1 focus:ring-[var(--brass)]/20 focus:outline-none"
                  />
                </div>

                <button
                  type="button"
                  onClick={saveKeys}
                  className="rounded-lg bg-zinc-800 border border-zinc-700 hover:border-zinc-500 hover:bg-zinc-750 px-4 py-2 text-xs font-bold text-zinc-200 cursor-pointer transition shadow-md"
                >
                  Save API Keys
                </button>
              </div>
            </section>
          </div>

          {/* Right panel: Flat pricing details & crew */}
          <aside className="space-y-8">
            <section className="glass-panel riveted rivet-bottom p-6 rounded-2xl shadow-xl border-amber-500/20">
              <h2 className="font-cinzel text-md font-bold text-zinc-200 mb-4 uppercase tracking-wide">Forge Workspace Flat Pricing</h2>
              
              <div className="space-y-4">
                <div className="flex justify-between items-baseline">
                  <span className="text-xs text-zinc-400">Current active plan:</span>
                  <span className="rounded-full bg-[var(--brass)]/15 border border-[var(--brass)]/30 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-[var(--brass)]">
                    Pro Builder
                  </span>
                </div>

                <div className="text-xs text-zinc-400 leading-relaxed bg-white/[0.01] p-3 rounded-lg border border-white/5">
                  <strong className="text-zinc-200">AI Included:</strong> Flat rate plan means you never get billed for model token consumption. Egress is secured by a default-deny deny filter.
                </div>

                <div className="space-y-2">
                  <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-widest block">Core limits</span>
                  <div className="flex justify-between text-xs font-mono text-zinc-300">
                    <span>Sandboxes</span>
                    <span>Unlimited</span>
                  </div>
                  <div className="flex justify-between text-xs font-mono text-zinc-300">
                    <span>Per-Run Cap</span>
                    <span>$5.00 Limit</span>
                  </div>
                  <div className="flex justify-between text-xs font-mono text-zinc-300">
                    <span>Egress Filter</span>
                    <span>Default-Deny</span>
                  </div>
                </div>

                <Link
                  href="/pricing"
                  className="block text-center text-xs font-bold text-[var(--brass)] hover:underline pt-2"
                >
                  Manage subscription billing →
                </Link>
              </div>
            </section>

            <section className="glass-panel riveted rivet-bottom p-6 rounded-2xl shadow-xl">
              <h2 className="font-cinzel text-md font-bold text-zinc-200 mb-4 uppercase tracking-wide">Mascot Crew</h2>
              
              <div className="flex items-center gap-3">
                <Toad className="h-10 w-10 shadow shadow-black/40" />
                <div className="text-xs">
                  <strong className="text-zinc-200 block">Ronald SaaSyToad</strong>
                  <span className="text-zinc-500">Forge Founder & Pipeline Agent</span>
                </div>
              </div>
            </section>
          </aside>
        </div>
      </main>
    </div>
  )
}
