'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { Plan } from '@forge/shared'
import * as client from '@/lib/forge-client'
import { Toad } from '@/components/Toad'
import { cn } from '@/lib/cn'

export default function PricingPage() {
  const [plans, setPlans] = useState<Plan[] | null>(null)
  const [loadingPlanId, setLoadingPlanId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    client
      .getPlans()
      .then(setPlans)
      .catch(() => setPlans([]))
  }, [])

  async function handleCheckout(planId: string) {
    setLoadingPlanId(planId)
    setError(null)
    try {
      const res = await client.createCheckout(planId)
      window.location.href = res.url
    } catch (err: any) {
      console.error('Checkout redirect failed:', err)
      setError(err?.message ?? 'Failed to initiate checkout. Please try again.')
      setLoadingPlanId(null)
    }
  }

  return (
    <main className="mx-auto min-h-dvh max-w-4xl px-6 py-16 animate-slide-up">
      <div className="mb-3 flex items-center gap-3">
        <Toad className="h-8 w-8" />
        <h1 className="text-2xl font-semibold tracking-tight text-white">Simple, flat pricing</h1>
        <Link href="/workspaces" className="ml-auto text-sm text-zinc-400 transition hover:text-zinc-200">
          open workspace
        </Link>
      </div>
      <p className="mb-8 text-sm text-zinc-500">
        AI is included on every plan. Never metered, never a surprise bill. Pick a plan and the
        price is the price.
      </p>

      {error && (
        <div className="mb-6 rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {plans === null ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-700 border-t-[var(--brass)]" />
          <p className="text-sm text-zinc-500">Loading plans...</p>
        </div>
      ) : plans.length === 0 ? (
        <p className="rounded-lg border border-dashed border-white/10 px-4 py-10 text-center text-sm text-zinc-500">
          No plans available at the moment.
        </p>
      ) : (
        <div className="grid gap-6 sm:grid-cols-3">
          {plans.map((plan) => {
            const isPro = plan.id === 'pro'
            const isLoading = loadingPlanId === plan.id
            const isAnyLoading = loadingPlanId !== null

            return (
              <div
                key={plan.id}
                className={cn(
                  'flex flex-col rounded-xl p-6 glass-panel glass-panel-hover relative overflow-hidden',
                  isPro && 'glow-pro border-[var(--brass)]/30'
                )}
              >
                {isPro && (
                  <span className="absolute top-3 right-3 rounded-full bg-[var(--brass)]/15 border border-[var(--brass)]/30 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[var(--brass)]">
                    Most Popular
                  </span>
                )}
                <div className="text-sm font-medium text-zinc-400">{plan.name}</div>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-4xl font-bold tracking-tight text-white">${plan.priceUsd}</span>
                  <span className="text-sm text-zinc-500">/{plan.interval}</span>
                </div>
                <p className="mt-2 text-xs text-zinc-500 leading-relaxed min-h-[32px]">{plan.blurb}</p>
                
                <ul className="mt-6 space-y-2.5 text-xs text-zinc-300 flex-1">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <span className="text-[var(--brass)] font-semibold" aria-hidden>✓</span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  disabled={isAnyLoading}
                  onClick={() => void handleCheckout(plan.id)}
                  className={cn(
                    'mt-8 w-full cursor-pointer rounded-lg py-2.5 text-center text-sm font-semibold transition-all duration-200 focus:outline-none flex items-center justify-center gap-2',
                    isPro
                      ? 'bg-[var(--brass)] text-black hover:brightness-110 shadow-lg shadow-[var(--brass)]/10'
                      : 'border border-zinc-700 text-zinc-200 hover:bg-white/5 hover:border-zinc-500',
                    isAnyLoading && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  {isLoading ? (
                    <>
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      <span>Redirecting...</span>
                    </>
                  ) : (
                    <span>Subscribe</span>
                  )}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </main>
  )
}
