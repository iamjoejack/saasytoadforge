import { Logo } from '@/components/Logo'

const FEATURES = [
  {
    title: 'Plan',
    body: 'Describe the task in plain language. The lead agent breaks it into a reviewable plan before a single line is written.',
  },
  {
    title: 'Edit in a sandbox',
    body: 'Agents work in an isolated workspace, not your machine. Every edit is contained, diffable, and easy to roll back.',
  },
  {
    title: 'Run and verify',
    body: 'It builds, runs, and checks its own work, then fixes what it broke, so you get something that actually works.',
  },
  {
    title: 'Reviewable artifacts',
    body: 'Plans, diffs, and run logs for every change. You stay in control and see exactly what happened and why.',
  },
]

export default function Home() {
  return (
    <div className="min-h-dvh flex flex-col">
      {/* Top nav */}
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <Logo wordmark="Forge" markSize={26} />
        <nav className="flex items-center gap-5 text-sm">
          <a
            href="/signin"
            className="text-zinc-300 transition hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-500"
          >
            Sign in
          </a>
          <a
            href="/workspaces"
            className="rounded-md bg-[var(--brass)] px-4 py-2 text-sm font-semibold text-black transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brass)]"
          >
            Open workspace
          </a>
        </nav>
      </header>

      {/* Hero */}
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-20 text-center">
        <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-[var(--brass)]/40 px-4 py-1 text-sm font-medium tracking-wide text-[var(--brass)]">
          Agent-first coding workspace
        </span>

        <h1 className="max-w-3xl text-balance text-4xl font-semibold tracking-tight text-white sm:text-6xl">
          Describe the task. Watch it ship.
        </h1>

        <p className="mt-5 max-w-xl text-pretty text-base leading-relaxed text-zinc-400">
          Describe what you want to build, and a team of AI agents plans it, writes it in a safe
          sandbox, and hands back a working app or site, with a reviewable trail for every change.
        </p>

        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <a
            href="/workspaces"
            className="rounded-md bg-[var(--brass)] px-5 py-2.5 text-sm font-semibold text-black transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brass)]"
          >
            Open workspace
          </a>
          <a
            href="#how-it-works"
            className="rounded-md border border-zinc-700 px-5 py-2.5 text-sm font-medium text-zinc-200 transition hover:border-zinc-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-500"
          >
            See how it works
          </a>
        </div>

        {/* Features */}
        <section
          id="how-it-works"
          className="mx-auto mt-24 grid w-full max-w-5xl gap-4 text-left sm:grid-cols-2"
        >
          {FEATURES.map((f, i) => (
            <div
              key={f.title}
              className="rounded-xl border border-zinc-800 bg-white/[0.02] p-6 transition hover:border-[var(--brass)]/40"
            >
              <div className="mb-3 flex size-8 items-center justify-center rounded-md border border-[var(--brass)]/40 text-sm font-semibold text-[var(--brass)]">
                {i + 1}
              </div>
              <h3 className="text-base font-semibold text-white">{f.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">{f.body}</p>
            </div>
          ))}
        </section>
      </main>

      {/* Footer */}
      <footer className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 border-t border-zinc-900 px-6 py-8 text-sm text-zinc-500 sm:flex-row">
        <Logo wordmark="Forge" markSize={20} />
        <p>A SaaSyToad product. Honest pricing, AI included.</p>
        <div className="flex items-center gap-5">
          <a href="/signin" className="transition hover:text-zinc-300">
            Sign in
          </a>
          <a href="/workspaces" className="transition hover:text-zinc-300">
            Workspaces
          </a>
        </div>
      </footer>
    </div>
  )
}
