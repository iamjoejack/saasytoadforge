'use client'

import { Suspense, useState, type FormEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { OWNER_EMAILS, isOwnerEmailDefault } from '@forge/shared'
import { Toad } from '@/components/Toad'
import { cn } from '@/lib/cn'

/** First owner email, pre-filled on the owner-setup shortcut for convenience. */
const OWNER_EMAIL = OWNER_EMAILS[0] ?? ''

function SignInForm() {
  const router = useRouter()
  const params = useSearchParams()
  const next = params.get('next') ?? '/workspaces'
  const isOwnerSetup = params.get('setup') === 'owner'

  const [mode, setMode] = useState<'signin' | 'signup'>(isOwnerSetup ? 'signup' : 'signin')
  const [email, setEmail] = useState(isOwnerSetup ? OWNER_EMAIL : '')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const isOwner = isOwnerEmailDefault(email)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (mode === 'signup' && password !== confirm) {
      setError('Passwords do not match')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    setBusy(true)
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        setError(body.error ?? 'something went wrong')
        setBusy(false)
        return
      }
      router.push(next)
      router.refresh()
    } catch {
      setError('could not reach the server')
      setBusy(false)
    }
  }

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center px-6 overflow-hidden">
      {/* Premium ambient backdrop */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-96 w-96 rounded-full bg-[var(--brass)]/5 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-40 left-1/2 -translate-x-1/2 h-96 w-96 rounded-full bg-[var(--copper)]/5 blur-[120px]" />

      <div className="w-full max-w-sm glass-panel p-8 rounded-2xl shadow-2xl relative z-10 animate-slide-up">
        <div className="mb-8 flex flex-col items-center text-center">
          <Toad className="h-14 w-14 shadow-lg shadow-black/40 ring-2 ring-[var(--brass)]/20" />
          <h1 className="mt-5 text-2xl font-bold tracking-tight text-white">
            {mode === 'signin' ? 'Welcome back' : 'Create your account'}
          </h1>
          <p className="mt-1.5 text-xs font-medium tracking-wide uppercase text-[var(--brass)]">
            SaaSyToad Forge
          </p>
        </div>

        {/* Owner account banner */}
        {isOwner && (
          <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-[var(--brass)]/30 bg-[var(--brass)]/8 px-3.5 py-3">
            <div>
              <p className="text-[12px] font-bold text-[var(--brass)] leading-snug">Company Owner Account</p>
              <p className="text-[11px] text-zinc-400 mt-0.5 leading-relaxed">
                This account has <strong className="text-white">unlimited</strong> agent access — no token or spending limits.
              </p>
            </div>
          </div>
        )}

        <form onSubmit={submit} className="space-y-3.5">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">
              Email address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className={cn(
                'w-full rounded-lg border border-white/10 bg-black/40 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 transition-all',
                'focus:border-[var(--brass)]/50 focus:ring-1 focus:ring-[var(--brass)]/20 focus:outline-none',
                isOwner && 'border-[var(--brass)]/25 bg-[var(--brass)]/5'
              )}
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="8+ characters"
              className={cn(
                'w-full rounded-lg border border-white/10 bg-black/40 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 transition-all',
                'focus:border-[var(--brass)]/50 focus:ring-1 focus:ring-[var(--brass)]/20 focus:outline-none'
              )}
            />
          </div>

          {/* Confirm password — only shown on signup */}
          {mode === 'signup' && (
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">
                Confirm password
              </label>
              <input
                type="password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Re-enter password"
                className={cn(
                  'w-full rounded-lg border border-white/10 bg-black/40 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 transition-all',
                  'focus:border-[var(--brass)]/50 focus:ring-1 focus:ring-[var(--brass)]/20 focus:outline-none',
                  confirm && password !== confirm ? 'border-red-500/50' : ''
                )}
              />
              {confirm && password !== confirm && (
                <p className="mt-1 text-[10px] text-red-400">Passwords do not match</p>
              )}
            </div>
          )}

          {error ? (
            <p className="text-xs text-red-400 font-medium bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-lg">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={busy || (mode === 'signup' && password !== confirm)}
            className={cn(
              'w-full rounded-lg px-4 py-2.5 text-sm font-semibold transition-all cursor-pointer mt-1',
              'hover:brightness-110 active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2 shadow-lg',
              isOwner
                ? 'bg-gradient-to-r from-[var(--brass)] to-[var(--copper)] text-black shadow-[var(--brass)]/15'
                : 'bg-[var(--brass)] text-black shadow-[var(--brass)]/10'
            )}
          >
            {busy ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-black border-t-transparent" />
                <span>Working...</span>
              </>
            ) : (
              <span>
                {mode === 'signin'
                  ? isOwner ? 'Sign in as owner' : 'Sign in'
                  : isOwner ? 'Create owner account' : 'Create account'}
              </span>
            )}
          </button>
        </form>

        {/* Mode switcher */}
        <div className="mt-5 flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setMode(mode === 'signin' ? 'signup' : 'signin')
              setError(null)
              setConfirm('')
            }}
            className="text-xs text-zinc-400 transition hover:text-zinc-200 cursor-pointer"
          >
            {mode === 'signin' ? "Don't have an account? Create one" : 'Already have an account? Sign in'}
          </button>

          {/* Quick owner account setup shortcut */}
          {!isOwner && mode === 'signup' && (
            <button
              type="button"
              onClick={() => setEmail(OWNER_EMAIL)}
              className="text-[10px] text-[var(--brass)]/60 hover:text-[var(--brass)] transition cursor-pointer"
            >
              Set up owner account
            </button>
          )}
        </div>

        {/* Owner setup hint — only on first visit */}
        {isOwnerSetup && mode === 'signup' && (
          <div className="mt-4 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2.5 text-[10px] text-zinc-450 leading-relaxed">
            <strong className="text-emerald-400">Setup tip:</strong> Choose a strong password. Once created, this account bypasses all spending limits and has full admin access to Forge.
          </div>
        )}
      </div>
    </main>
  )
}

export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <SignInForm />
    </Suspense>
  )
}
