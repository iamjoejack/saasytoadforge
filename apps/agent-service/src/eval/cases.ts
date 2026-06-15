import type { AgentEvent } from '@forge/shared'

export interface EvalCase {
  name: string
  task: string
  /** Returns a list of failure messages; empty means the case passed. */
  check: (events: AgentEvent[]) => string[]
}

function countEdits(events: AgentEvent[]): number {
  return events.filter((e) => e.type === 'edit').length
}

function passingRun(events: AgentEvent[]): boolean {
  const terminal = events.find((e) => e.type === 'terminal')
  return terminal?.type === 'terminal' && terminal.result.exitCode === 0
}

function finishedOk(events: AgentEvent[]): boolean {
  const done = events.at(-1)
  return done?.type === 'done' && done.ok
}

/**
 * Fixed eval cases so model/config changes can be regression-checked without manual
 * babysitting (mission section 9). Runs on the mock model today; swap in a real planner
 * to evaluate OpenRouter against the same bar.
 */
export const EVAL_CASES: EvalCase[] = [
  {
    name: 'time-endpoint',
    task: 'add an endpoint that returns the current time and a test for it',
    check: (events) => {
      const fails: string[] = []
      if (countEdits(events) < 2) fails.push(`expected >= 2 edits, got ${countEdits(events)}`)
      if (!passingRun(events)) fails.push('expected a passing test run (exit 0)')
      if (!finishedOk(events)) fails.push('expected the run to finish ok')
      return fails
    },
  },
  {
    name: 'ui-page',
    task: 'build a greeting page with a button and a test',
    check: (events) => {
      const fails: string[] = []
      if (countEdits(events) < 3) fails.push(`expected >= 3 edits, got ${countEdits(events)}`)
      if (!events.some((e) => e.type === 'screenshot')) fails.push('expected a screenshot artifact')
      if (!passingRun(events)) fails.push('expected a passing test run (exit 0)')
      if (!finishedOk(events)) fails.push('expected the run to finish ok')
      return fails
    },
  },
  {
    name: 'generic-note',
    task: 'remember to follow up with the client next week',
    check: (events) => {
      const fails: string[] = []
      if (countEdits(events) < 1) fails.push('expected at least one edit')
      if (!finishedOk(events)) fails.push('expected the run to finish ok')
      return fails
    },
  },
]
