'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { Plan } from '@forge/shared'
import * as client from '@/lib/forge-client'
import { Toad } from '@/components/Toad'
import { cn } from '@/lib/cn'

export default function PricingPage() {
  const [plans, setPlans] = useState<Plan[] | null>(null)

  useEffect(() => {
    client
      .getPlans()
      .then(setPlans)
      .catch(() => setPlans([]))
  }, [])

  return (
    <main className="mx-auto min-h-dvh max-w-4xl px-6 py-16">
      <div className="mb-3 flex items-center gap-3">
        <Toad className="h-8 w-8" />
        <h1 className="text-2xl font-semibold tracking-tight text-white">Simple, flat pricing</h1>
        <Link href="/workspaces" className="ml-auto text-sm text-zinc-400 transition hover:text-zinc-200">
          open workspace
        </Link>
      </div>
      <p className="mb-10 text-sm text-zinc-500">
        AI is included on every plan. Never metered, never a surprise bill. Pick a plan and the
        price is the price.
      </p>

      {plans === null ? (
        <p className="text-sm text-zinc-500">Loading...</p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={cn(
                'flex flex-col rounded-xl border p-6',
                plan.id === 'pro' ? 'border-[var(--brass)]/50 bg-[var(--brass)]/5' : 'border-white/10',
              )}
            >
              <div className="text-sm font-medium text-zinc-300">{plan.name}</div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-3xl font-semibold text-white">${plan.priceUsd}</span>
                <span className="text-sm text-zinc-500">/{plan.interval}</span>
              </div>
              <p className="mt-1 text-sm text-zinc-500">{plan.blurb}</p>
              <ul className="mt-5 space-y-2 text-sm text-zinc-300">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <span className="mt-0.5 text-[var(--brass)]">+</span>
                    {feature}
                  </li>
                ))}
              </ul>
              <Link
                href="/workspaces"
                className={cn(
                  'mt-6 rounded-lg px-4 py-2.5 text-center text-sm font-semibold transition',
                  plan.id === 'pro'
                    ? 'bg-[var(--brass)] text-black hover:brightness-110'
                    : 'border border-zinc-700 text-zinc-200 hover:border-zinc-500',
                )}
              >
                Start free
              </Link>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
