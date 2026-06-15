'use client'

import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import type { ConfigSummary } from '@forge/shared'
import * as client from '@/lib/forge-client'
import { Toad } from '@/components/Toad'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
      <h2 className="mb-3 text-sm font-medium text-zinc-200">{title}</h2>
      {children}
    </section>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-white/5 py-2 text-sm last:border-0">
      <span className="text-zinc-500">{label}</span>
      <span className="font-mono text-zinc-200">{value}</span>
    </div>
  )
}

function StatusPill({ live }: { live: boolean }) {
  return (
    <span
      className={
        live
          ? 'rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-400'
          : 'rounded-full bg-white/5 px-2 py-0.5 text-[11px] font-medium text-zinc-500'
      }
    >
      {live ? 'live' : 'mock'}
    </span>
  )
}

export default function SettingsPage() {
  const [config, setConfig] = useState<ConfigSummary | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    client
      .getConfig()
      .then(setConfig)
      .catch(() => setError(true))
  }, [])

  return (
    <main className="mx-auto min-h-dvh max-w-2xl px-6 py-14">
      <div className="mb-8 flex items-center gap-3">
        <Toad className="h-7 w-7" />
        <h1 className="text-xl font-semibold tracking-tight text-white">Settings</h1>
        <Link href="/workspaces" className="ml-auto text-sm text-zinc-400 transition hover:text-zinc-200">
          back to workspaces
        </Link>
      </div>
      <p className="mb-6 text-sm text-zinc-500">
        Read-only view of the policy Forge enforces. Pricing is flat: AI is included, never
        metered. The caps below are an internal cost control, not a customer charge.
      </p>

      {error ? (
        <p className="text-sm text-red-400">Could not reach the agent service.</p>
      ) : !config ? (
        <p className="text-sm text-zinc-500">Loading...</p>
      ) : (
        <div className="space-y-5">
          <Section title="Model routing">
            <Row label="Fast tier" value={config.models.fast} />
            <Row label="Frontier tier" value={config.models.frontier} />
            <Row label="Deep reasoning (gated)" value={config.models.deep} />
          </Section>

          <Section title="Spend caps (internal cost control)">
            <Row label="Per user" value={`$${config.caps.perUserUsd.toFixed(2)}`} />
            <Row label="Global" value={`$${config.caps.globalUsd.toFixed(2)}`} />
          </Section>

          <Section title="Sandbox">
            <Row label="Provider" value={config.sandboxProvider} />
            <div className="pt-2">
              <div className="mb-1 text-sm text-zinc-500">Egress allowlist (default-deny)</div>
              {config.egressAllowlist.length === 0 ? (
                <p className="text-sm text-zinc-600">No domains allowed.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {config.egressAllowlist.map((d) => (
                    <span key={d} className="rounded border border-white/10 px-2 py-0.5 font-mono text-xs text-zinc-300">
                      {d}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </Section>

          <Section title="Connected services">
            <div className="space-y-2">
              {(
                [
                  ['OpenRouter (models)', config.secrets.openrouter],
                  ['E2B (sandboxes)', config.secrets.e2b],
                  ['Supabase (auth + data)', config.secrets.supabase],
                  ['Stripe (billing)', config.secrets.stripe],
                ] as const
              ).map(([label, live]) => (
                <div key={label} className="flex items-center justify-between text-sm">
                  <span className="text-zinc-400">{label}</span>
                  <StatusPill live={live} />
                </div>
              ))}
            </div>
          </Section>
        </div>
      )}
    </main>
  )
}
