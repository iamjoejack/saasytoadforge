import { describe, it, expect } from 'vitest'
import type { AgentEvent } from '@forge/shared'
import { MockSandboxProvider } from '../sandbox'
import { Agent, ApprovalGate } from './agent'
import { MockPlanner } from './planner'

async function setup() {
  const provider = new MockSandboxProvider()
  const sandbox = await provider.create({ template: 'node', envAllowlist: [] })
  return { provider, sandboxId: sandbox.id }
}

const CANONICAL = 'add an endpoint that returns the current time and a test for it'

describe('Agent loop (mock)', () => {
  it('plans, edits files, runs the test green, and emits artifacts', async () => {
    const { provider, sandboxId } = await setup()
    const events: AgentEvent[] = []
    const { ok } = await new Agent(provider, sandboxId).run(
      { task: CANONICAL, planner: new MockPlanner(), approvals: new ApprovalGate() },
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

    // The edits really landed in the sandbox, and a diff artifact was emitted.
    expect(await provider.readFile(sandboxId, 'src/time.mjs')).toContain('currentTime')
    expect(await provider.readFile(sandboxId, 'test/time.test.mjs')).toContain('node:test')
    const edit = events.find((e) => e.type === 'edit')
    if (edit?.type !== 'edit') throw new Error('no edit event')
    expect(edit.diff).toContain('+export function currentTime')

    const done = events.at(-1)
    if (done?.type !== 'done') throw new Error('no done event')
    expect(done.ok).toBe(true)
  })

  it('pauses writes for approval and applies them once approved', async () => {
    const { provider, sandboxId } = await setup()
    const gate = new ApprovalGate()
    const events: AgentEvent[] = []
    const { ok } = await new Agent(provider, sandboxId).run(
      { task: CANONICAL, planner: new MockPlanner(), approvals: gate, requireWriteApproval: true },
      (e) => {
        events.push(e)
        if (e.type === 'approval') queueMicrotask(() => gate.resolve(e.id, true))
      },
    )
    expect(ok).toBe(true)
    expect(events.some((e) => e.type === 'approval')).toBe(true)
    expect(await provider.readFile(sandboxId, 'src/time.mjs')).toContain('currentTime')
  })

  it('skips the write and fails the run when approval is rejected', async () => {
    const { provider, sandboxId } = await setup()
    const gate = new ApprovalGate()
    const events: AgentEvent[] = []
    const { ok } = await new Agent(provider, sandboxId).run(
      { task: CANONICAL, planner: new MockPlanner(), approvals: gate, requireWriteApproval: true },
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
