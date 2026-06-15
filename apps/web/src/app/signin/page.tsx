'use client'

import { Suspense, useState, type FormEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Toad } from '@/components/Toad'
import { cn } from '@/lib/cn'

function SignInForm() {
  const router = useRouter()
  const params = useSearchParams()
  const next = params.get('next') ?? '/workspaces'

  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password }),
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
      {/* Premium ambient backdrop glowing orbs */}
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

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className={cn(
                'w-full rounded-lg border border-white/10 bg-black/40 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 transition-all',
                'focus:border-[var(--brass)]/50 focus:ring-1 focus:ring-[var(--brass)]/20 focus:outline-none'
              )}
            />
          </div>
          <div className="space-y-1">
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="password (8+ characters)"
              className={cn(
                'w-full rounded-lg border border-white/10 bg-black/40 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 transition-all',
                'focus:border-[var(--brass)]/50 focus:ring-1 focus:ring-[var(--brass)]/20 focus:outline-none'
              )}
            />
          </div>

          {error ? (
            <p className="text-xs text-red-400 font-medium bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-lg">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={busy}
            className={cn(
              'w-full rounded-lg bg-[var(--brass)] px-4 py-2.5 text-sm font-semibold text-black transition-all cursor-pointer',
              'hover:brightness-110 active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2 shadow-lg shadow-[var(--brass)]/10'
            )}
          >
            {busy ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-black border-t-transparent" />
                <span>Working...</span>
              </>
            ) : (
              <span>{mode === 'signin' ? 'Sign in' : 'Sign up'}</span>
            )}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setMode(mode === 'signin' ? 'signup' : 'signin')
            setError(null)
          }}
          className="mt-6 w-full text-center text-xs text-zinc-400 transition hover:text-zinc-200 cursor-pointer"
        >
          {mode === 'signin' ? 'New here? Create an account' : 'Already have an account? Sign in'}
        </button>
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
