import { describe, it, expect } from 'vitest'
import type { AgentEvent } from '@forge/shared'
import { runEval, runAgenticEval } from './runner'
import type { EvalCase } from './cases'
import { MockSandboxProvider } from '../sandbox'
import type { LlmClient, CompleteOptions } from '../agent/llm'

/** Replays a fixed script of model responses, one per call. */
class ScriptedLlm implements LlmClient {
  readonly kind = 'anthropic' as const
  private i = 0
  constructor(private readonly script: string[]) {}
  async complete(_opts: CompleteOptions): Promise<string> {
    const out = this.script[this.i] ?? '{"tool":"finish","args":{"summary":"done"}}'
    this.i++
    return out
  }
}

describe('agent eval harness', () => {
  it('every fixed eval case passes on the mock model', async () => {
    const report = await runEval()
    const failed = report.results.filter((r) => !r.pass)
    expect(failed, JSON.stringify(failed)).toHaveLength(0)
    expect(report.passed).toBe(report.total)
    expect(report.total).toBeGreaterThanOrEqual(3)
  })

  it('runAgenticEval drives the real agentic loop and scores the event stream', async () => {
    const cases: EvalCase[] = [
      {
        name: 'writes-a-readme',
        task: 'create a readme file',
        check: (events: AgentEvent[]) => {
          const fails: string[] = []
          if (!events.some((e) => e.type === 'edit')) fails.push('expected an edit')
          const done = events.at(-1)
          if (!(done?.type === 'done' && done.ok)) fails.push('expected an ok finish')
          return fails
        },
      },
    ]

    const report = await runAgenticEval(cases, {
      makeLlm: () =>
        new ScriptedLlm([
          '{"tool":"write_file","args":{"path":"README.md","contents":"# hi\\n"}}',
          '{"tool":"finish","args":{"summary":"done"}}',
        ]),
      makeProvider: () => new MockSandboxProvider(),
      model: 'claude-sonnet-4-5',
    })

    expect(report.passed).toBe(1)
    expect(report.total).toBe(1)
    expect(report.llmKind).toBe('anthropic')
    expect(report.sandboxKind).toBe('mock')
  })
})
