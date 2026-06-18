import type { AgentEvent } from '@forge/shared'
import { runAgentic, type AgenticOptions, type Emit } from './agentic'

/**
 * Best-of-N for coding tasks. The research on test-time compute is blunt: sampling N attempts
 * only pays off with a STRONG selector, and the strongest cheap selector is an executable
 * signal (the tests pass), not an LLM judge. So the selector is the caller's job here, scored
 * over each attempt's event stream rather than a vibe.
 *
 * This is expensive (N full agent runs), so it is an opt-in primitive, not the default path.
 * Each attempt MUST run in its own sandbox (its own opts.tools) so parallel writes never
 * collide.
 */

export interface BestOfNAttempt {
  /** The agentic run to execute. Must use its own sandbox/tools to stay isolated. */
  opts: AgenticOptions
  /** Score the finished attempt by its event stream; the highest score wins. */
  score: (events: AgentEvent[]) => number | Promise<number>
  /** Optional label surfaced on the winning result. */
  label?: string
}

export interface BestOfNResult {
  /** Index of the winning attempt. */
  winner: number
  label?: string
  events: AgentEvent[]
  score: number
  /** Score of every attempt, in input order, for transparency. */
  scores: number[]
}

/** Run the attempts in parallel and keep the highest-scoring one. */
export async function runBestOfN(attempts: BestOfNAttempt[]): Promise<BestOfNResult | null> {
  if (attempts.length === 0) return null

  const runs = await Promise.all(
    attempts.map(async (attempt) => {
      const events: AgentEvent[] = []
      const collect: Emit = (e) => events.push(e)
      try {
        await runAgentic(attempt.opts, collect)
        const score = await attempt.score(events)
        return { events, score, label: attempt.label }
      } catch {
        // A broken attempt (or scorer) scores lowest rather than failing the whole batch.
        return { events, score: Number.NEGATIVE_INFINITY, label: attempt.label }
      }
    }),
  )

  let best = 0
  for (let i = 1; i < runs.length; i++) {
    if ((runs[i]?.score ?? -Infinity) > (runs[best]?.score ?? -Infinity)) best = i
  }
  const winner = runs[best]
  if (!winner) return null
  return {
    winner: best,
    label: winner.label,
    events: winner.events,
    score: winner.score,
    scores: runs.map((r) => r?.score ?? Number.NEGATIVE_INFINITY),
  }
}

/**
 * A ready-made selector: passing tests are the strongest cheap signal. Rewards clean test
 * runs (exit 0), penalizes failures and errors, and gives a small nudge for actually editing
 * and finishing cleanly. Use it when the agent runs the project's tests during the attempt.
 */
export function scoreByPassingRun(events: AgentEvent[]): number {
  let score = 0
  let sawTerminal = false
  for (const e of events) {
    if (e.type === 'terminal') {
      sawTerminal = true
      score += e.result.exitCode === 0 ? 1 : -1
    } else if (e.type === 'edit') {
      score += 0.1
    } else if (e.type === 'error') {
      score -= 5
    }
  }
  const done = events.at(-1)
  if (done?.type === 'done' && done.ok) score += 0.5
  // A run that never executed anything is weaker than one that ran and passed.
  return sawTerminal ? score : score - 0.25
}
