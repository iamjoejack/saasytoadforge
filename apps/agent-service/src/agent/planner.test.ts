import { describe, it, expect } from 'vitest'
import { parseServerEnv } from '@forge/shared'
import { parsePlan, LlmPlanner, MockPlanner, createPlanner } from './planner'
import { MockLlmClient, type CompleteOptions, type LlmClient } from './llm'

class FakeOpenRouter implements LlmClient {
  readonly kind = 'openrouter' as const
  constructor(private readonly reply: string) {}
  async complete(_opts: CompleteOptions): Promise<string> {
    return this.reply
  }
}

describe('parsePlan', () => {
  it('parses message, steps, and actions even with prose and code fences', () => {
    const raw =
      'Sure!\n```json\n' +
      JSON.stringify({
        message: 'hi',
        steps: [{ id: 's1', title: 'do' }],
        actions: [
          { kind: 'edit', stepId: 's1', path: 'a.ts', contents: 'x' },
          { kind: 'run', stepId: 's1', cmd: 'node --test a' },
        ],
      }) +
      '\n```'
    const actions = parsePlan(raw)
    expect(actions[0]).toEqual({ kind: 'message', text: 'hi' })
    expect(actions.some((a) => a.kind === 'plan')).toBe(true)
    expect(actions.filter((a) => a.kind === 'edit')).toHaveLength(1)
    expect(actions.filter((a) => a.kind === 'run')).toHaveLength(1)
  })

  it('throws when there is no JSON object', () => {
    expect(() => parsePlan('no json here')).toThrow()
  })
})

describe('MockPlanner', () => {
  it('scripts the canonical time task', async () => {
    const actions = await new MockPlanner().plan('add a current time endpoint and a test')
    expect(actions.filter((a) => a.kind === 'edit')).toHaveLength(2)
    expect(actions.some((a) => a.kind === 'run')).toBe(true)
  })

  it('falls back to a NOTES.md edit for arbitrary tasks', async () => {
    const actions = await new MockPlanner().plan('do something unusual')
    const edit = actions.find((a) => a.kind === 'edit')
    expect(edit?.kind === 'edit' && edit.path).toBe('NOTES.md')
  })
})

describe('LlmPlanner', () => {
  it('turns an LLM reply into actions', async () => {
    const reply = JSON.stringify({
      message: 'ok',
      steps: [{ id: 's1', title: 't' }],
      actions: [{ kind: 'edit', stepId: 's1', path: 'f.ts', contents: 'c' }],
    })
    const actions = await new LlmPlanner(new FakeOpenRouter(reply), 'test-model').plan('go')
    expect(actions.some((a) => a.kind === 'edit' && a.path === 'f.ts')).toBe(true)
  })
})

describe('createPlanner', () => {
  it('returns MockPlanner without an OpenRouter client', () => {
    expect(createPlanner(parseServerEnv({}), new MockLlmClient())).toBeInstanceOf(MockPlanner)
  })

  it('returns LlmPlanner when the client is openrouter-backed', () => {
    expect(createPlanner(parseServerEnv({}), new FakeOpenRouter('{}'))).toBeInstanceOf(LlmPlanner)
  })
})
