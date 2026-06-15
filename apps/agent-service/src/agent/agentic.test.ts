import { describe, it, expect } from 'vitest'
import type { AgentEvent } from '@forge/shared'
import { runAgentic, parseToolCall, type AgenticOptions } from './agentic'
import { ApprovalGate } from './agent'
import { createToolSet } from './tools'
import { MockBrowserTool } from './tools'
import { MockSandboxProvider } from '../sandbox/mock-provider'
import type { LlmClient, CompleteOptions, LlmMessage } from './llm'

/** An LLM stub that replays a fixed script of responses, one per call. */
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

async function setup(script: string[], task: string, history: LlmMessage[] = []) {
  const provider = new MockSandboxProvider()
  const sandbox = await provider.create({ template: 'node', envAllowlist: [] })
  const tools = createToolSet(provider, sandbox.id, new MockBrowserTool())
  const events: AgentEvent[] = []
  const opts: AgenticOptions = {
    task,
    llm: new ScriptedLlm(script),
    model: 'claude-sonnet-4-5',
    tools,
    approvals: new ApprovalGate(),
    history,
  }
  const result = await runAgentic(opts, (e) => events.push(e))
  return { provider, sandbox, events, result }
}

describe('parseToolCall', () => {
  it('parses a bare JSON tool call', () => {
    const call = parseToolCall('{"tool":"run","args":{"cmd":"ls"}}')
    expect(call?.tool).toBe('run')
    expect(call?.args.cmd).toBe('ls')
  })

  it('parses a fenced JSON tool call', () => {
    const call = parseToolCall('```json\n{"tool":"read_file","args":{"path":"a.txt"}}\n```')
    expect(call?.tool).toBe('read_file')
  })

  it('treats prose as a chat reply, not a tool call', () => {
    expect(parseToolCall('Hi there, here is what I think about your code.')).toBeNull()
  })

  it('ignores JSON with an unknown tool', () => {
    expect(parseToolCall('{"tool":"delete_everything","args":{}}')).toBeNull()
  })
})

describe('runAgentic', () => {
  it('writes a file, runs a test, and finishes', async () => {
    const { provider, sandbox, events, result } = await setup(
      [
        '{"thought":"add a test","tool":"write_file","args":{"path":"test/x.test.mjs","contents":"import {test} from \'node:test\'\\ntest(\'ok\',()=>{})\\n"}}',
        '{"thought":"run it","tool":"run","args":{"cmd":"node --test test/x.test.mjs"}}',
        '{"tool":"finish","args":{"summary":"Added and ran a test."}}',
      ],
      'add a passing test',
    )

    expect(result.ok).toBe(true)
    expect(events.some((e) => e.type === 'edit' && e.path === 'test/x.test.mjs')).toBe(true)
    const terminal = events.find((e) => e.type === 'terminal')
    expect(terminal && terminal.type === 'terminal' && terminal.result.exitCode).toBe(0)
    expect(events.at(-1)).toEqual({ type: 'done', ok: true })
    // the file really exists in the sandbox
    expect(await provider.readFile(sandbox.id, 'test/x.test.mjs')).toContain('node:test')
  })

  it('answers a plain question as a chat reply without tools', async () => {
    const { events, result } = await setup(
      ['Forge is an agent-first coding workspace. Ask me to build something and I will.'],
      'what is forge?',
    )
    expect(result.ok).toBe(true)
    const messages = events.filter((e) => e.type === 'message')
    expect(messages.length).toBe(1)
    expect(events.some((e) => e.type === 'edit' || e.type === 'terminal')).toBe(false)
    expect(events.at(-1)).toEqual({ type: 'done', ok: true })
  })

  it('appends the turn to chat history for continuity', async () => {
    const history: LlmMessage[] = []
    await setup(['Hello, I am Ronald.'], 'hi', history)
    expect(history.length).toBe(2)
    expect(history[0]).toEqual({ role: 'user', content: 'hi' })
    expect(history[1]?.role).toBe('assistant')
  })

  it('respects write approval rejection', async () => {
    const provider = new MockSandboxProvider()
    const sandbox = await provider.create({ template: 'node', envAllowlist: [] })
    const tools = createToolSet(provider, sandbox.id, new MockBrowserTool())
    const approvals = new ApprovalGate()
    const events: AgentEvent[] = []

    const opts: AgenticOptions = {
      task: 'write a file',
      llm: new ScriptedLlm([
        '{"tool":"write_file","args":{"path":"danger.txt","contents":"x"}}',
        '{"tool":"finish","args":{"summary":"stopped"}}',
      ]),
      model: 'claude-sonnet-4-5',
      tools,
      approvals,
      requireWriteApproval: true,
      history: [],
    }

    await runAgentic(opts, (e) => {
      events.push(e)
      // Resolve on the next tick, mirroring the real flow where the rejection arrives as a
      // later websocket message (after the loop has registered the pending approval).
      if (e.type === 'approval') setTimeout(() => approvals.resolve(e.id, false), 0)
    })

    expect(events.some((e) => e.type === 'approval')).toBe(true)
    expect(events.some((e) => e.type === 'edit')).toBe(false)
    await expect(provider.readFile(sandbox.id, 'danger.txt')).rejects.toThrow()
  })
})
