import type { ReviewCheck, ReviewVerdict, SandboxProvider } from '@forge/shared'
import type { LlmClient } from './llm'

/**
 * Ronald, the boss. Before a deploy, he reviews the workspace and gives an honest verdict:
 * is it launch ready, and if not, what is missing and what to do. The user can always deploy
 * anyway. Ronald never claims a build passed when he could not actually run it.
 */

export interface ReviewOptions {
  /** When set (and not mock), Ronald adds a qualitative code review. */
  llm?: LlmClient
  model?: string
  /** True when the sandbox cannot execute real build/test commands. Defaults from the id. */
  simulated?: boolean
}

interface PackageJson {
  name?: string
  scripts?: Record<string, string>
}

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', '.turbo', 'coverage'])
const MAX_WALK = 400

/** Bounded breadth-first walk of the workspace, skipping heavy/generated directories. */
async function walkFiles(provider: SandboxProvider, sandboxId: string): Promise<string[]> {
  const out: string[] = []
  const queue: string[] = ['']
  while (queue.length > 0 && out.length < MAX_WALK) {
    const dir = queue.shift() ?? ''
    let entries
    try {
      entries = await provider.listFiles(sandboxId, dir)
    } catch {
      continue
    }
    for (const entry of entries) {
      if (entry.type === 'dir') {
        if (!SKIP_DIRS.has(entry.name)) queue.push(entry.path)
      } else {
        out.push(entry.path)
        if (out.length >= MAX_WALK) break
      }
    }
  }
  return out
}

/** A command that the sandbox could not actually execute (mock provider, missing binary). */
function couldNotRun(exitCode: number, stderr: string): boolean {
  return exitCode === 127 || /not executable|command not found|: not found/i.test(stderr)
}

function tail(text: string, lines = 6): string {
  return text.trim().split('\n').slice(-lines).join('\n')
}

const SOURCE_RE = /\.(m?[jt]sx?|css|html|json|md)$/i
const TEST_RE = /(\.|_)(test|spec)\.[mc]?[jt]sx?$/i

async function runScriptChecks(
  provider: SandboxProvider,
  sandboxId: string,
  scripts: Record<string, string>,
  checks: ReviewCheck[],
  blockers: string[],
  recommendations: string[],
): Promise<void> {
  const steps: Array<{ name: string; key: string; blocking: boolean }> = [
    { name: 'Type check', key: 'typecheck', blocking: true },
    { name: 'Lint', key: 'lint', blocking: false },
    { name: 'Build', key: 'build', blocking: true },
    { name: 'Tests', key: 'test', blocking: true },
  ]

  for (const step of steps) {
    if (!scripts[step.key]) {
      if (step.key === 'build') {
        checks.push({ name: step.name, status: 'warn', detail: 'No build script to verify.' })
        recommendations.push('Add a build script so deploys can be verified.')
      } else if (step.key === 'test') {
        checks.push({ name: step.name, status: 'warn', detail: 'No test script.' })
        recommendations.push('Add a test script to catch regressions before deploy.')
      } else {
        checks.push({ name: step.name, status: 'skip', detail: `No ${step.key} script.` })
      }
      continue
    }

    let res
    try {
      res = await provider.exec(sandboxId, `npm run ${step.key} --silent`)
    } catch (err) {
      checks.push({ name: step.name, status: 'skip', detail: err instanceof Error ? err.message : 'could not run' })
      continue
    }

    if (res.exitCode === 0) {
      checks.push({ name: step.name, status: 'pass', detail: `${step.key} passed.` })
    } else if (couldNotRun(res.exitCode, res.stderr)) {
      checks.push({
        name: step.name,
        status: 'skip',
        detail: `Could not run ${step.key} in this sandbox. Deploy to a real sandbox to verify.`,
      })
    } else {
      const detail = tail(res.stderr || res.stdout) || `${step.key} failed (exit ${res.exitCode})`
      checks.push({ name: step.name, status: 'fail', detail })
      if (step.blocking) blockers.push(`${step.name} fails. Fix it before deploying.`)
      else recommendations.push(`${step.name} reports problems worth cleaning up.`)
    }
  }
}

async function staticChecks(
  provider: SandboxProvider,
  sandboxId: string,
  checks: ReviewCheck[],
  recommendations: string[],
): Promise<void> {
  const files = await walkFiles(provider, sandboxId)

  const testFiles = files.filter((f) => TEST_RE.test(f) || f.includes('/__tests__/'))
  if (testFiles.length === 0) {
    checks.push({ name: 'Test coverage', status: 'warn', detail: 'No test files found in the workspace.' })
    recommendations.push('Add at least one smoke test.')
  } else {
    checks.push({ name: 'Test coverage', status: 'pass', detail: `${testFiles.length} test file(s) present.` })
  }

  const committedEnv = files.filter((f) => /(^|\/)\.env(\.local|\.production)?$/.test(f))
  if (committedEnv.length > 0) {
    checks.push({ name: 'Secrets', status: 'warn', detail: `Found ${committedEnv.join(', ')} in the workspace.` })
    recommendations.push('Keep real secrets out of committed files; use environment variables.')
  } else {
    checks.push({ name: 'Secrets', status: 'pass', detail: 'No committed .env files detected.' })
  }

  // Scan a bounded sample of source for leftover markers.
  const sample = files.filter((f) => SOURCE_RE.test(f) && !TEST_RE.test(f)).slice(0, 30)
  let markers = 0
  for (const path of sample) {
    let contents = ''
    try {
      contents = await provider.readFile(sandboxId, path)
    } catch {
      continue
    }
    const found = contents.match(/\b(TODO|FIXME|HACK|XXX|DO NOT SHIP)\b/g)
    if (found) markers += found.length
  }
  if (markers > 0) {
    checks.push({ name: 'Leftover markers', status: 'warn', detail: `${markers} TODO/FIXME-style marker(s) in source.` })
    recommendations.push('Resolve or remove leftover TODO/FIXME markers before launch.')
  }

  if (!files.some((f) => /(^|\/)readme\.md$/i.test(f))) {
    recommendations.push('Add a README so others can run the project.')
  }
}

interface LlmReviewResult {
  blockers?: string[]
  recommendations?: string[]
  summary?: string
}

/** Optional qualitative review from the model. Best-effort: never throws into the verdict. */
async function llmReview(
  provider: SandboxProvider,
  sandboxId: string,
  llm: LlmClient,
  model: string,
): Promise<LlmReviewResult | null> {
  const files = (await walkFiles(provider, sandboxId))
    .filter((f) => SOURCE_RE.test(f))
    .slice(0, 6)
  if (files.length === 0) return null

  const snippets: string[] = []
  let budget = 12000
  for (const path of files) {
    if (budget <= 0) break
    try {
      const contents = await provider.readFile(sandboxId, path)
      const slice = contents.slice(0, Math.min(2500, budget))
      budget -= slice.length
      snippets.push(`### ${path}\n${slice}`)
    } catch {
      // skip unreadable file
    }
  }

  const raw = await llm.complete({
    model,
    messages: [
      {
        role: 'system',
        content:
          'You are Ronald, reviewing a workspace before deploy. Reply with ONLY JSON: ' +
          '{"blockers": string[], "recommendations": string[], "summary": string}. ' +
          'Blockers are concrete issues that should stop a launch (real bugs, security holes, broken flows). ' +
          'Keep each item to one plain sentence, sentence case, no emojis or dashes. At most 5 of each.',
      },
      { role: 'user', content: `Review these files:\n\n${snippets.join('\n\n')}` },
    ],
  })

  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start === -1 || end <= start) return null
  try {
    return JSON.parse(raw.slice(start, end + 1)) as LlmReviewResult
  } catch {
    return null
  }
}

function scoreFrom(checks: ReviewCheck[], blockers: string[]): number {
  let score = 100
  for (const check of checks) {
    if (check.status === 'fail') score -= 22
    else if (check.status === 'warn') score -= 6
    else if (check.status === 'skip') score -= 2
  }
  score -= Math.max(0, blockers.length - checks.filter((c) => c.status === 'fail').length) * 10
  return Math.max(0, Math.min(100, score))
}

function summarize(ready: boolean, blockers: string[], simulated: boolean): string {
  const note = simulated
    ? ' Heads up: this workspace runs on the mock sandbox, so I could not run the real build or tests. Connect a real sandbox to fully verify.'
    : ''
  if (ready) {
    return `I went over the build and it looks solid. I did not find anything blocking a launch.${note} You are good to deploy.`
  }
  const lead =
    blockers.length > 0
      ? `I would hold off. ${blockers.length} thing${blockers.length === 1 ? '' : 's'} need attention before this is launch ready.`
      : 'I would tidy a few things up before launch, but nothing is hard blocking.'
  return `${lead}${note} You can still deploy if you want, but I would fix the blockers first.`
}

export async function reviewWorkspace(
  provider: SandboxProvider,
  sandboxId: string,
  opts: ReviewOptions = {},
): Promise<ReviewVerdict> {
  const simulated = opts.simulated ?? sandboxId.startsWith('mock_')
  const checks: ReviewCheck[] = []
  const blockers: string[] = []
  const recommendations: string[] = []

  let pkg: PackageJson | null = null
  try {
    pkg = JSON.parse(await provider.readFile(sandboxId, 'package.json')) as PackageJson
  } catch {
    pkg = null
  }

  if (pkg) {
    checks.push({
      name: 'Project manifest',
      status: 'pass',
      detail: `Found package.json${pkg.name ? ` for ${pkg.name}` : ''}.`,
    })
  } else {
    checks.push({ name: 'Project manifest', status: 'warn', detail: 'No package.json at the workspace root.' })
    recommendations.push('Add a package.json with build and test scripts so deploys can be verified.')
  }

  await runScriptChecks(provider, sandboxId, pkg?.scripts ?? {}, checks, blockers, recommendations)
  await staticChecks(provider, sandboxId, checks, recommendations)

  if (opts.llm && opts.llm.kind !== 'mock' && opts.model) {
    try {
      const review = await llmReview(provider, sandboxId, opts.llm, opts.model)
      if (review) {
        for (const b of (review.blockers ?? []).slice(0, 5)) {
          blockers.push(b)
          checks.push({ name: 'Code review', status: 'fail', detail: b })
        }
        for (const r of (review.recommendations ?? []).slice(0, 5)) recommendations.push(r)
      }
    } catch {
      // qualitative review is best-effort; ignore failures
    }
  }

  const ready = checks.every((c) => c.status !== 'fail') && blockers.length === 0
  return {
    ready,
    score: scoreFrom(checks, blockers),
    summary: summarize(ready, blockers, simulated),
    checks,
    blockers,
    recommendations,
  }
}
