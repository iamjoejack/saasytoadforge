import { describe, it, expect } from 'vitest'
import type { AgentEvent } from '@forge/shared'
import { runAgentic, parseToolCall, type AgenticOptions } from './agentic'
import { ApprovalGate, QuestionGate } from './agent'
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

  it('interviews via the ask tool and uses the answer', async () => {
    const provider = new MockSandboxProvider()
    const sandbox = await provider.create({ template: 'node', envAllowlist: [] })
    const tools = createToolSet(provider, sandbox.id, new MockBrowserTool())
    const questions = new QuestionGate()
    const events: AgentEvent[] = []

    const opts: AgenticOptions = {
      task: 'build me something',
      llm: new ScriptedLlm([
        '{"tool":"ask","args":{"question":"Who is this for?","options":["Solo","Team"]}}',
        '{"tool":"finish","args":{"summary":"Got it, building for a team."}}',
      ]),
      model: 'claude-sonnet-4-5',
      tools,
      approvals: new ApprovalGate(),
      questions,
      history: [],
    }

    await runAgentic(opts, (e) => {
      events.push(e)
      if (e.type === 'question') setTimeout(() => questions.resolve(e.id, ['Team']), 0)
    })

    const q = events.find((e) => e.type === 'question')
    expect(q && q.type === 'question' && q.question).toBe('Who is this for?')
    expect(events.at(-1)).toEqual({ type: 'done', ok: true })
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

  it('applies a surgical change with edit_file instead of overwriting', async () => {
    const { provider, sandbox, events, result } = await setup(
      [
        '{"tool":"write_file","args":{"path":"app.js","contents":"const port = 3000\\nconsole.log(port)\\n"}}',
        '{"tool":"edit_file","args":{"path":"app.js","edits":[{"search":"const port = 3000","replace":"const port = 8080"}]}}',
        '{"tool":"finish","args":{"summary":"changed the port"}}',
      ],
      'change the port to 8080',
    )

    expect(result.ok).toBe(true)
    expect(events.filter((e) => e.type === 'edit').length).toBe(2)
    const after = await provider.readFile(sandbox.id, 'app.js')
    expect(after).toContain('const port = 8080')
    expect(after).not.toContain('3000')
    expect(after).toContain('console.log(port)') // the rest of the file is untouched
  })

  it('reports a helpful error when edit_file targets a missing file', async () => {
    const { events, result } = await setup(
      [
        '{"tool":"edit_file","args":{"path":"nope.js","edits":[{"search":"a","replace":"b"}]}}',
        '{"tool":"finish","args":{"summary":"done"}}',
      ],
      'edit a file that does not exist',
    )

    expect(result.ok).toBe(true)
    expect(events.some((e) => e.type === 'edit')).toBe(false)
  })

  it('stops a tool call repeated three times in a row', async () => {
    const { events, result } = await setup(
      [
        '{"tool":"run","args":{"cmd":"ls"}}',
        '{"tool":"run","args":{"cmd":"ls"}}',
        '{"tool":"run","args":{"cmd":"ls"}}',
        '{"tool":"finish","args":{"summary":"giving up"}}',
      ],
      'list the directory over and over',
    )

    expect(result.ok).toBe(true)
    // The third identical run is blocked, so only the first two actually execute.
    expect(events.filter((e) => e.type === 'terminal').length).toBe(2)
    expect(events.some((e) => e.type === 'message' && /repeated action/i.test(e.text))).toBe(true)
  })

  it('verifies before finishing and re-prompts once when the build is not green', async () => {
    const provider = new MockSandboxProvider()
    const sandbox = await provider.create({ template: 'node', envAllowlist: [] })
    const tools = createToolSet(provider, sandbox.id, new MockBrowserTool())
    const events: AgentEvent[] = []
    let verifyCalls = 0

    const opts: AgenticOptions = {
      task: 'build a thing',
      llm: new ScriptedLlm([
        '{"tool":"write_file","args":{"path":"a.js","contents":"x"}}',
        '{"tool":"finish","args":{"summary":"done"}}',
        '{"tool":"finish","args":{"summary":"fixed it"}}',
      ]),
      model: 'claude-sonnet-4-5',
      tools,
      approvals: new ApprovalGate(),
      history: [],
      verify: async () => {
        verifyCalls += 1
        return verifyCalls === 1
          ? { ok: false, summary: 'typecheck failed' }
          : { ok: true, summary: 'all green' }
      },
    }

    const result = await runAgentic(opts, (e) => events.push(e))
    expect(result.ok).toBe(true)
    expect(verifyCalls).toBe(2) // blocked once, then re-verified the fix
    expect(events.some((e) => e.type === 'message' && /not finishing yet/i.test(e.text))).toBe(true)
    expect(events.at(-1)).toEqual({ type: 'done', ok: true })
  })

  it('skips verification when no edits were made', async () => {
    const provider = new MockSandboxProvider()
    const sandbox = await provider.create({ template: 'node', envAllowlist: [] })
    const tools = createToolSet(provider, sandbox.id, new MockBrowserTool())
    const events: AgentEvent[] = []
    let verifyCalls = 0

    const opts: AgenticOptions = {
      task: 'just answer a question',
      llm: new ScriptedLlm(['{"tool":"finish","args":{"summary":"nothing to build"}}']),
      model: 'claude-sonnet-4-5',
      tools,
      approvals: new ApprovalGate(),
      history: [],
      verify: async () => {
        verifyCalls += 1
        return { ok: false, summary: 'should not run' }
      },
    }

    const result = await runAgentic(opts, (e) => events.push(e))
    expect(result.ok).toBe(true)
    expect(verifyCalls).toBe(0)
  })

  it('finishes after one block even if checks still fail, and says so honestly', async () => {
    const provider = new MockSandboxProvider()
    const sandbox = await provider.create({ template: 'node', envAllowlist: [] })
    const tools = createToolSet(provider, sandbox.id, new MockBrowserTool())
    const events: AgentEvent[] = []
    let verifyCalls = 0

    const opts: AgenticOptions = {
      task: 'build a thing',
      llm: new ScriptedLlm([
        '{"tool":"write_file","args":{"path":"a.js","contents":"x"}}',
        '{"tool":"finish","args":{"summary":"done"}}',
        '{"tool":"finish","args":{"summary":"still done"}}',
      ]),
      model: 'claude-sonnet-4-5',
      tools,
      approvals: new ApprovalGate(),
      history: [],
      verify: async () => {
        verifyCalls += 1
        return { ok: false, summary: 'lint still failing' }
      },
    }

    const result = await runAgentic(opts, (e) => events.push(e))
    expect(result.ok).toBe(true)
    expect(verifyCalls).toBe(2)
    expect(
      events.some((e) => e.type === 'message' && /checks are still failing/i.test(e.text)),
    ).toBe(true)
  })
})
