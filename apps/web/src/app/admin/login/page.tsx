'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { isOwnerEmailDefault } from '@forge/shared/owners'
import { Logo } from '@/components/Logo'
import { cn } from '@/lib/cn'

export default function AdminLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [setupSecret, setSetupSecret] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const looksLikeOwner = isOwnerEmailDefault(email)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password, setupSecret: setupSecret || undefined }),
      })
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        setError(body.error ?? 'Could not sign in.')
        setBusy(false)
        return
      }
      router.push('/admin')
      router.refresh()
    } catch {
      setError('Could not reach the server.')
      setBusy(false)
    }
  }

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center px-6 overflow-hidden">
      <div className="circuit-grid opacity-30" />
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-96 w-96 rounded-full bg-[var(--brass)]/5 blur-[120px]" />

      <div className="w-full max-w-sm glass-panel p-8 rounded-2xl shadow-2xl relative z-10 animate-slide-up">
        <div className="mb-7 flex flex-col items-center text-center">
          <Logo wordmark="Forge" markSize={34} showWordmark={false} />
          <h1 className="mt-4 text-xl font-bold tracking-tight text-white font-cinzel">Owner and admin sign in</h1>
          <p className="mt-1.5 text-[11px] text-zinc-500 leading-relaxed">
            This is the back office. Customers sign in from the main app, not here.
          </p>
        </div>

        {looksLikeOwner && (
          <div className="mb-5 rounded-xl border border-[var(--brass)]/30 bg-[var(--brass)]/8 px-3.5 py-3">
            <p className="text-[12px] font-bold text-[var(--brass)] leading-snug">Owner account</p>
            <p className="text-[11px] text-zinc-400 mt-0.5 leading-relaxed">
              First time in? The password you enter now becomes your owner password.
            </p>
          </div>
        )}

        <form onSubmit={submit} className="space-y-3.5">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className={cn(
                'w-full rounded-lg border border-white/10 bg-black/40 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600',
                'focus:border-[var(--brass)]/50 focus:ring-1 focus:ring-[var(--brass)]/20 focus:outline-none',
              )}
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="8+ characters"
              className={cn(
                'w-full rounded-lg border border-white/10 bg-black/40 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600',
                'focus:border-[var(--brass)]/50 focus:ring-1 focus:ring-[var(--brass)]/20 focus:outline-none',
              )}
            />
          </div>

          {looksLikeOwner && (
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">
                Setup code <span className="text-zinc-600 normal-case font-normal">(first-time owner only, if your company set one)</span>
              </label>
              <input
                type="password"
                value={setupSecret}
                onChange={(e) => setSetupSecret(e.target.value)}
                placeholder="leave blank if not required"
                className="w-full rounded-lg border border-white/10 bg-black/40 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-[var(--brass)]/50 focus:ring-1 focus:ring-[var(--brass)]/20 focus:outline-none"
              />
            </div>
          )}

          {error && (
            <p className="text-xs text-red-400 font-medium bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-lg">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-[var(--brass)] text-black px-4 py-2.5 text-sm font-semibold transition-all cursor-pointer mt-1 hover:brightness-110 active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2 shadow-lg shadow-[var(--brass)]/10"
          >
            {busy ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-black border-t-transparent" />
                <span>Signing in...</span>
              </>
            ) : (
              <span>Sign in to the back office</span>
            )}
          </button>
        </form>
      </div>
    </main>
  )
}
