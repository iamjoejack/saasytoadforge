import { cn } from '@/lib/cn'

export default function Home() {
  return (
    <main className={cn('min-h-dvh', 'flex flex-col items-center justify-center', 'px-6 text-center')}>
      <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-[var(--brass)]/40 px-4 py-1 text-sm font-medium tracking-wide text-[var(--brass)]">
        SaaSyToad Forge
      </span>

      <h1 className="max-w-2xl text-balance text-4xl font-semibold tracking-tight text-white sm:text-6xl">
        Describe the task. Watch it ship.
      </h1>

      <p className="mt-5 max-w-xl text-pretty text-base leading-relaxed text-zinc-400">
        An agent-first coding workspace. Plan, edit, run, and verify inside an isolated sandbox, with
        reviewable artifacts for every change.
      </p>

      <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
        <a
          href="/workspaces"
          className="rounded-md bg-[var(--brass)] px-5 py-2.5 text-sm font-semibold text-black transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brass)]"
        >
          Open workspace
        </a>
        <a
          href="#"
          className="rounded-md border border-zinc-700 px-5 py-2.5 text-sm font-medium text-zinc-200 transition hover:border-zinc-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-500"
        >
          Read the docs
        </a>
      </div>
    </main>
  )
}
