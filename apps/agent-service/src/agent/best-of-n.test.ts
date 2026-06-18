import { describe, it, expect } from 'vitest'
import type { AgentEvent } from '@forge/shared'
import { runBestOfN, scoreByPassingRun, type BestOfNAttempt } from './best-of-n'
import { ApprovalGate } from './agent'
import { createToolSet, MockBrowserTool } from './tools'
import { MockSandboxProvider } from '../sandbox/mock-provider'
import type { LlmClient, CompleteOptions } from './llm'

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

/** Build an attempt with its own isolated sandbox. */
async function attempt(
  script: string[],
  score: BestOfNAttempt['score'],
  label: string,
): Promise<BestOfNAttempt> {
  const provider = new MockSandboxProvider()
  const sandbox = await provider.create({ template: 'node', envAllowlist: [] })
  const tools = createToolSet(provider, sandbox.id, new MockBrowserTool())
  return {
    label,
    score,
    opts: {
      task: 'build',
      llm: new ScriptedLlm(script),
      model: 'claude-sonnet-4-5',
      tools,
      approvals: new ApprovalGate(),
      history: [],
    },
  }
}

describe('runBestOfN', () => {
  it('returns null when there are no attempts', async () => {
    expect(await runBestOfN([])).toBeNull()
  })

  it('selects the highest-scoring attempt', async () => {
    const lazy = await attempt(
      ['{"tool":"finish","args":{"summary":"did nothing"}}'],
      () => 0,
      'lazy',
    )
    const builder = await attempt(
      [
        '{"tool":"write_file","args":{"path":"a.js","contents":"x"}}',
        '{"tool":"finish","args":{"summary":"built it"}}',
      ],
      (events) => (events.some((e) => e.type === 'edit') ? 1 : 0),
      'builder',
    )

    const result = await runBestOfN([lazy, builder])
    expect(result?.winner).toBe(1)
    expect(result?.label).toBe('builder')
    expect(result?.events.some((e) => e.type === 'edit')).toBe(true)
    expect(result?.scores).toEqual([0, 1])
  })

  it('survives an attempt whose scorer throws', async () => {
    const broken = await attempt(
      ['{"tool":"finish","args":{"summary":"ok"}}'],
      () => {
        throw new Error('bad scorer')
      },
      'broken',
    )
    const good = await attempt(['{"tool":"finish","args":{"summary":"ok"}}'], () => 1, 'good')

    const result = await runBestOfN([broken, good])
    expect(result?.winner).toBe(1)
    expect(result?.label).toBe('good')
  })
})

describe('scoreByPassingRun', () => {
  it('prefers a passing test run over a failing one', () => {
    const passing: AgentEvent[] = [
      {
        type: 'terminal',
        agent: 'verifier',
        result: { cmd: 'test', stdout: '', stderr: '', exitCode: 0 },
      },
      { type: 'done', ok: true },
    ]
    const failing: AgentEvent[] = [
      {
        type: 'terminal',
        agent: 'verifier',
        result: { cmd: 'test', stdout: '', stderr: '', exitCode: 1 },
      },
      { type: 'done', ok: true },
    ]
    expect(scoreByPassingRun(passing)).toBeGreaterThan(scoreByPassingRun(failing))
  })
})
