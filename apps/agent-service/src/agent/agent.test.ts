import { describe, it, expect } from 'vitest'
import type { AgentEvent } from '@forge/shared'
import { MockSandboxProvider } from '../sandbox'
import { Agent, ApprovalGate, QuestionGate } from './agent'
import { MockPlanner } from './planner'
import { MockBrowserTool, createToolSet } from './tools'

async function setup() {
  const provider = new MockSandboxProvider()
  const sandbox = await provider.create({ template: 'node', envAllowlist: [] })
  const tools = createToolSet(provider, sandbox.id, new MockBrowserTool())
  return { provider, sandboxId: sandbox.id, agent: new Agent(tools) }
}

const TIME_TASK = 'add an endpoint that returns the current time and a test for it'
const UI_TASK = 'build a greeting page with a button and a test'

describe('Agent loop (mock)', () => {
  it('plans, edits files, runs the test green, and emits artifacts', async () => {
    const { provider, sandboxId, agent } = await setup()
    const events: AgentEvent[] = []
    const { ok } = await agent.run(
      { task: TIME_TASK, planner: new MockPlanner(), approvals: new ApprovalGate(), questions: new QuestionGate() },
      (e) => events.push(e),
    )

    expect(ok).toBe(true)
    expect(events.filter((e) => e.type === 'edit')).toHaveLength(2)

    const plan = events.find((e) => e.type === 'plan')
    if (plan?.type !== 'plan') throw new Error('no plan event')
    expect(plan.steps).toHaveLength(3)

    const terminal = events.find((e) => e.type === 'terminal')
    if (terminal?.type !== 'terminal') throw new Error('no terminal event')
    expect(terminal.result.exitCode).toBe(0)
    expect(terminal.result.stdout).toContain('pass 1')

    const edit = events.find((e) => e.type === 'edit')
    if (edit?.type !== 'edit') throw new Error('no edit event')
    expect(edit.diff).toContain('+export function currentTime')
    expect(edit.before).toBe('')

    expect(await provider.readFile(sandboxId, 'src/time.mjs')).toContain('currentTime')

    const done = events.at(-1)
    if (done?.type !== 'done') throw new Error('no done event')
    expect(done.ok).toBe(true)
  })

  it('decomposes a UI task into subagents with a multi-file diff and a screenshot', async () => {
    const { provider, sandboxId, agent } = await setup()
    const events: AgentEvent[] = []
    const { ok } = await agent.run(
      { task: UI_TASK, planner: new MockPlanner(), approvals: new ApprovalGate(), questions: new QuestionGate() },
      (e) => events.push(e),
    )

    expect(ok).toBe(true)

    // Multi-file diff across subagents.
    const edits = events.filter((e) => e.type === 'edit')
    expect(edits.length).toBeGreaterThanOrEqual(3)
    expect(events.some((e) => e.type === 'edit' && e.agent === 'coder')).toBe(true)

    // Plan carries subagent roles.
    const plan = events.find((e) => e.type === 'plan')
    if (plan?.type !== 'plan') throw new Error('no plan event')
    expect(plan.steps.some((s) => s.role === 'browser')).toBe(true)

    // Green verifier run.
    const terminal = events.find((e) => e.type === 'terminal')
    if (terminal?.type !== 'terminal') throw new Error('no terminal event')
    expect(terminal.result.exitCode).toBe(0)

    // Screenshot artifact from the browser subagent.
    const shot = events.find((e) => e.type === 'screenshot')
    if (shot?.type !== 'screenshot') throw new Error('no screenshot event')
    expect(shot.image).toMatch(/^data:image\//)
    expect(shot.agent).toBe('browser')

    expect(await provider.readFile(sandboxId, 'public/index.html')).toContain('Hello from Forge')
  })

  it('pauses writes for approval and applies them once approved', async () => {
    const { provider, sandboxId, agent } = await setup()
    const gate = new ApprovalGate()
    const events: AgentEvent[] = []
    const { ok } = await agent.run(
      { task: TIME_TASK, planner: new MockPlanner(), approvals: gate, requireWriteApproval: true, questions: new QuestionGate() },
      (e) => {
        events.push(e)
        if (e.type === 'approval') queueMicrotask(() => gate.resolve(e.id, true))
      },
    )
    expect(ok).toBe(true)
    expect(events.some((e) => e.type === 'approval')).toBe(true)
    expect(await provider.readFile(sandboxId, 'src/time.mjs')).toContain('currentTime')
  })

  it('emits error then done(ok:false) when the planner fails', async () => {
    const { agent } = await setup()
    const events: AgentEvent[] = []
    const failing = {
      kind: 'mock' as const,
      plan: () => Promise.reject(new Error('planner exploded')),
    }
    const { ok } = await agent.run(
      { task: 'anything', planner: failing, approvals: new ApprovalGate(), questions: new QuestionGate() },
      (e) => events.push(e),
    )
    expect(ok).toBe(false)
    expect(events.some((e) => e.type === 'error')).toBe(true)
    const done = events.at(-1)
    expect(done?.type === 'done' && done.ok).toBe(false)
  })

  it('skips the write and fails the run when approval is rejected', async () => {
    const { provider, sandboxId, agent } = await setup()
    const gate = new ApprovalGate()
    const events: AgentEvent[] = []
    const { ok } = await agent.run(
      { task: TIME_TASK, planner: new MockPlanner(), approvals: gate, requireWriteApproval: true, questions: new QuestionGate() },
      (e) => {
        events.push(e)
        if (e.type === 'approval') queueMicrotask(() => gate.resolve(e.id, false))
      },
    )
    expect(ok).toBe(false)
    await expect(provider.readFile(sandboxId, 'src/time.mjs')).rejects.toThrow()
    expect(events.some((e) => e.type === 'step' && e.status === 'skipped')).toBe(true)
  })
})
