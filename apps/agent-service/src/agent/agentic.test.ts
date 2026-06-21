import { describe, it, expect } from 'vitest'
import type { AgentEvent } from '@forge/shared'
import {
  runAgentic,
  parseToolCall,
  searchWorkspace,
  buildRepoMap,
  compactMessages,
  type AgenticOptions,
} from './agentic'
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

  it('tolerates a trailing comma in the tool JSON', () => {
    const call = parseToolCall('{"tool":"run","args":{"cmd":"ls",}}')
    expect(call?.tool).toBe('run')
    expect(call?.args.cmd).toBe('ls')
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

  it('recovers from a malformed tool call instead of ending the turn', async () => {
    const { events, result } = await setup(
      [
        '{"tool": "run", "args": {"cmd": "ls"', // looks like a tool call but is invalid JSON
        '{"tool":"finish","args":{"summary":"ok"}}',
      ],
      'do something',
    )

    expect(result.ok).toBe(true)
    expect(events.some((e) => e.type === 'message' && /malformed tool call/i.test(e.text))).toBe(
      true,
    )
    expect(events.at(-1)).toEqual({ type: 'done', ok: true })
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

  it('runs verification after a shell-only task, since run can mutate the workspace', async () => {
    const provider = new MockSandboxProvider()
    const sandbox = await provider.create({ template: 'node', envAllowlist: [] })
    const tools = createToolSet(provider, sandbox.id, new MockBrowserTool())
    const events: AgentEvent[] = []
    let verifyCalls = 0

    const opts: AgenticOptions = {
      task: 'install a dependency',
      llm: new ScriptedLlm([
        '{"tool":"run","args":{"cmd":"echo installing"}}',
        '{"tool":"finish","args":{"summary":"done"}}',
      ]),
      model: 'claude-sonnet-4-5',
      tools,
      approvals: new ApprovalGate(),
      history: [],
      verify: async () => {
        verifyCalls += 1
        return { ok: true, summary: 'green' }
      },
    }

    const result = await runAgentic(opts, (e) => events.push(e))
    expect(result.ok).toBe(true)
    expect(verifyCalls).toBe(1) // run armed the verify gate even with no file-write tool
  })

  it('gates the run tool behind approval when write approval is on', async () => {
    const provider = new MockSandboxProvider()
    const sandbox = await provider.create({ template: 'node', envAllowlist: [] })
    const tools = createToolSet(provider, sandbox.id, new MockBrowserTool())
    const approvals = new ApprovalGate()
    const events: AgentEvent[] = []

    const opts: AgenticOptions = {
      task: 'run a command',
      llm: new ScriptedLlm([
        '{"tool":"run","args":{"cmd":"echo hi"}}',
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
      if (e.type === 'approval') setTimeout(() => approvals.resolve(e.id, false), 0)
    })

    expect(events.some((e) => e.type === 'approval' && e.action === 'Run command')).toBe(true)
    expect(events.some((e) => e.type === 'terminal')).toBe(false) // rejected, never executed
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

  it('loads a skill via the skill tool', async () => {
    const provider = new MockSandboxProvider()
    const sandbox = await provider.create({ template: 'node', envAllowlist: [] })
    const tools = createToolSet(provider, sandbox.id, new MockBrowserTool())
    const events: AgentEvent[] = []

    const opts: AgenticOptions = {
      task: 'make my landing page rank on google',
      llm: new ScriptedLlm([
        '{"tool":"skill","args":{"name":"seo-optimize"}}',
        '{"tool":"finish","args":{"summary":"applied SEO"}}',
      ]),
      model: 'claude-sonnet-4-5',
      tools,
      approvals: new ApprovalGate(),
      history: [],
    }

    const result = await runAgentic(opts, (e) => events.push(e))
    expect(result.ok).toBe(true)
    expect(events.some((e) => e.type === 'message' && /SEO optimizer skill/.test(e.text))).toBe(
      true,
    )
  })

  it('can call the search tool and finish', async () => {
    const provider = new MockSandboxProvider()
    const sandbox = await provider.create({ template: 'node', envAllowlist: [] })
    await provider.writeFile(sandbox.id, 'src/app.js', 'const secret = 42\n')
    const tools = createToolSet(provider, sandbox.id, new MockBrowserTool())
    const events: AgentEvent[] = []

    const opts: AgenticOptions = {
      task: 'find the secret',
      llm: new ScriptedLlm([
        '{"tool":"search","args":{"query":"secret"}}',
        '{"tool":"finish","args":{"summary":"found it"}}',
      ]),
      model: 'claude-sonnet-4-5',
      tools,
      approvals: new ApprovalGate(),
      history: [],
    }

    const result = await runAgentic(opts, (e) => events.push(e))
    expect(result.ok).toBe(true)
    expect(events.at(-1)).toEqual({ type: 'done', ok: true })
  })

  it('deletes a file with delete_file', async () => {
    const provider = new MockSandboxProvider()
    const sandbox = await provider.create({ template: 'node', envAllowlist: [] })
    await provider.writeFile(sandbox.id, 'old.js', 'remove me\n')
    const tools = createToolSet(provider, sandbox.id, new MockBrowserTool())
    const events: AgentEvent[] = []

    const opts: AgenticOptions = {
      task: 'delete old.js',
      llm: new ScriptedLlm([
        '{"tool":"delete_file","args":{"path":"old.js"}}',
        '{"tool":"finish","args":{"summary":"removed it"}}',
      ]),
      model: 'claude-sonnet-4-5',
      tools,
      approvals: new ApprovalGate(),
      history: [],
    }

    const result = await runAgentic(opts, (e) => events.push(e))
    expect(result.ok).toBe(true)
    await expect(provider.readFile(sandbox.id, 'old.js')).rejects.toThrow(/no such file/)
    expect(events.some((e) => e.type === 'message' && /Deleted old\.js/.test(e.text))).toBe(true)
  })

  it('reverts this turn changes back to the starting state with the revert tool', async () => {
    const provider = new MockSandboxProvider()
    const sandbox = await provider.create({ template: 'node', envAllowlist: [] })
    const tools = createToolSet(provider, sandbox.id, new MockBrowserTool())
    const events: AgentEvent[] = []

    const opts: AgenticOptions = {
      task: 'build then bail',
      llm: new ScriptedLlm([
        '{"tool":"write_file","args":{"path":"a.js","contents":"x"}}',
        '{"tool":"revert","args":{}}',
        '{"tool":"finish","args":{"summary":"reverted"}}',
      ]),
      model: 'claude-sonnet-4-5',
      tools,
      approvals: new ApprovalGate(),
      history: [],
    }

    const result = await runAgentic(opts, (e) => events.push(e))
    expect(result.ok).toBe(true)
    // The checkpoint was taken before the write, so reverting removes the file.
    await expect(provider.readFile(sandbox.id, 'a.js')).rejects.toThrow(/no such file/)
    expect(events.some((e) => e.type === 'message' && /Reverted/i.test(e.text))).toBe(true)
  })
})

describe('searchWorkspace', () => {
  async function workspaceWith(files: Record<string, string>) {
    const provider = new MockSandboxProvider()
    const sandbox = await provider.create({ template: 'node', envAllowlist: [] })
    for (const [path, contents] of Object.entries(files)) {
      await provider.writeFile(sandbox.id, path, contents)
    }
    return createToolSet(provider, sandbox.id, new MockBrowserTool())
  }

  it('finds matching lines, case-insensitive, with file and line number', async () => {
    const tools = await workspaceWith({
      'src/app.js': 'const port = 3000\nstartServer(port)\n',
      'src/util.js': 'export const PORT = 3000\n',
    })
    const matches = await searchWorkspace(tools, 'port')
    expect(matches.length).toBeGreaterThanOrEqual(3) // port, port, PORT
    expect(matches.some((m) => /src\/app\.js:1:/.test(m))).toBe(true)
  })

  it('skips dependency directories like node_modules', async () => {
    const tools = await workspaceWith({
      'index.js': 'needle here\n',
      'node_modules/dep/index.js': 'needle in deps\n',
    })
    const matches = await searchWorkspace(tools, 'needle')
    expect(matches.length).toBe(1)
    expect(matches.some((m) => m.includes('node_modules'))).toBe(false)
  })

  it('returns nothing when there is no match', async () => {
    const tools = await workspaceWith({ 'a.txt': 'hello world\n' })
    expect(await searchWorkspace(tools, 'zzz')).toEqual([])
  })
})

describe('compactMessages', () => {
  it('returns the input unchanged when it fits the budget', () => {
    const msgs: LlmMessage[] = [
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'task' },
      { role: 'assistant', content: 'ok' },
    ]
    expect(compactMessages(msgs, 1000)).toBe(msgs)
  })

  it('keeps the system prompt, the task, and recent messages, omitting the middle', () => {
    const big = 'x'.repeat(200)
    const msgs: LlmMessage[] = [
      { role: 'system', content: 'SYSTEM' },
      { role: 'user', content: 'TASK' },
      ...Array.from({ length: 20 }, (_, k) => ({ role: 'user' as const, content: `${big}#${k}` })),
    ]
    const out = compactMessages(msgs, 600)
    expect(out[0]?.content).toBe('SYSTEM') // system prompt kept
    expect(out[1]?.content).toBe('TASK') // original task kept
    expect(out.some((m) => /earlier step/.test(m.content))).toBe(true) // middle summarized
    expect(out.length).toBeLessThan(msgs.length)
    expect(out.at(-1)?.content).toContain('#19') // most recent message preserved
  })
})

describe('buildRepoMap', () => {
  async function workspaceWith(files: Record<string, string>) {
    const provider = new MockSandboxProvider()
    const sandbox = await provider.create({ template: 'node', envAllowlist: [] })
    for (const [path, contents] of Object.entries(files)) {
      await provider.writeFile(sandbox.id, path, contents)
    }
    return createToolSet(provider, sandbox.id, new MockBrowserTool())
  }

  it('lists source files with their top-level symbols, skipping deps and non-source', async () => {
    const tools = await workspaceWith({
      'src/app.ts': 'export function greet(name) {}\nexport class Server {}\n',
      'src/util.py': 'def format_date():\n    pass\n',
      'README.md': '# hi',
      'node_modules/dep/index.js': 'export function x() {}',
    })
    const map = await buildRepoMap(tools)
    expect(map).toContain('src/app.ts: greet, Server')
    expect(map).toContain('src/util.py: format_date')
    expect(map).not.toContain('README.md')
    expect(map).not.toContain('node_modules')
  })

  it('reports when there are no source files', async () => {
    const tools = await workspaceWith({ 'notes.txt': 'hello' })
    expect(await buildRepoMap(tools)).toBe('(no source files found)')
  })
})
