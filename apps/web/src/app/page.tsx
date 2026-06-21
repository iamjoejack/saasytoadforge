import Link from 'next/link'
import { Toad } from '@/components/Toad'

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div className="glass-panel rounded-xl p-6">
      <h3 className="text-base font-semibold tracking-tight text-white">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-zinc-400">{body}</p>
    </div>
  )
}

export default function Home() {
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-white/5 bg-black/50 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <Toad className="h-7 w-7" />
            <span className="font-cinzel text-sm font-bold tracking-tight text-white">
              SaaSyToad Forge
            </span>
          </Link>
          <nav className="flex items-center gap-5 text-sm">
            <Link href="/pricing" className="text-zinc-400 transition hover:text-white">
              Pricing
            </Link>
            <Link
              href="/signin"
              className="hidden text-zinc-400 transition hover:text-white sm:block"
            >
              Sign in
            </Link>
            <Link
              href="/workspaces"
              className="rounded-md bg-[var(--brass)] px-4 py-2 text-sm font-semibold text-black transition hover:brightness-110"
            >
              Open workspace
            </Link>
          </nav>
        </div>
      </header>

      <section className="relative overflow-hidden px-6 pt-24 pb-20 text-center">
        <div className="pointer-events-none absolute -top-40 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-[var(--brass)]/5 blur-[120px]" />
        <span className="relative inline-flex items-center gap-2 rounded-full border border-[var(--brass)]/40 px-4 py-1 text-sm font-medium tracking-wide text-[var(--brass)]">
          SaaSyToad Forge
        </span>
        <h1 className="relative mx-auto mt-6 max-w-2xl text-balance text-4xl font-semibold tracking-tight text-white sm:text-6xl">
          Describe the task. Watch it ship.
        </h1>
        <p className="relative mx-auto mt-5 max-w-xl text-pretty text-base leading-relaxed text-zinc-400">
          An agent-first coding workspace. Plan, edit, run, and verify inside an isolated sandbox,
          with reviewable artifacts for every change.
        </p>
        <div className="relative mt-9 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/workspaces"
            className="rounded-md bg-[var(--brass)] px-5 py-2.5 text-sm font-semibold text-black transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brass)]"
          >
            Open workspace
          </Link>
          <Link
            href="/pricing"
            className="rounded-md border border-zinc-700 px-5 py-2.5 text-sm font-medium text-zinc-200 transition hover:border-zinc-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-500"
          >
            See pricing
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-4">
        <div className="grid gap-6 sm:grid-cols-3">
          <Feature
            title="Flat pricing, AI included"
            body="Never metered, never a surprise bill. The price is the price, on every plan."
          />
          <Feature
            title="A real isolated sandbox"
            body="Your code runs in an isolated microVM, not a fake preview. Real installs, real builds, real tests."
          />
          <Feature
            title="Verified before it ships"
            body="Ronald reviews every change and will not let you ship a build that is broken or unsafe."
          />
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-6 py-20 text-center">
        <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          One price. Everything included.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-pretty text-base leading-relaxed text-zinc-400">
          Other tools meter your AI and surprise you with the bill. Forge is flat. Bring your own
          key or use ours, with no lockouts and no credit anxiety.
        </p>
        <Link
          href="/pricing"
          className="mt-7 inline-flex rounded-md bg-[var(--brass)] px-5 py-2.5 text-sm font-semibold text-black transition hover:brightness-110"
        >
          See pricing
        </Link>
      </section>

      <footer className="border-t border-white/5 px-6 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-sm text-zinc-500 sm:flex-row">
          <div className="flex items-center gap-2">
            <Toad className="h-5 w-5" />
            <span>SaaSyToad Forge</span>
          </div>
          <div className="flex gap-6">
            <Link href="/pricing" className="transition hover:text-zinc-300">
              Pricing
            </Link>
            <Link href="/admin/login" className="transition hover:text-zinc-300">
              Owner sign in
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
