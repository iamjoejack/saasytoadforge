import type { AgentEvent } from '@forge/shared'
import { MockSandboxProvider } from '../sandbox'
import { Agent, ApprovalGate, QuestionGate } from '../agent/agent'
import { MockPlanner, type Planner } from '../agent/planner'
import { createToolSet, MockBrowserTool } from '../agent/tools'
import { EVAL_CASES, type EvalCase } from './cases'

export interface EvalResult {
  name: string
  pass: boolean
  failures: string[]
}

export interface EvalReport {
  results: EvalResult[]
  passed: number
  total: number
}

/**
 * Runs each eval case through the agent loop against deterministic mocks and checks its
 * assertions. Pass a different planner factory to evaluate a real model on the same bar.
 */
export async function runEval(
  cases: EvalCase[] = EVAL_CASES,
  makePlanner: () => Planner = () => new MockPlanner(),
): Promise<EvalReport> {
  const results: EvalResult[] = []

  for (const evalCase of cases) {
    const provider = new MockSandboxProvider()
    const sandbox = await provider.create({ template: 'node', envAllowlist: [] })
    const tools = createToolSet(provider, sandbox.id, new MockBrowserTool())
    const events: AgentEvent[] = []

    await new Agent(tools).run(
      { task: evalCase.task, planner: makePlanner(), approvals: new ApprovalGate(), questions: new QuestionGate() },
      (e) => events.push(e),
    )

    const failures = evalCase.check(events)
    results.push({ name: evalCase.name, pass: failures.length === 0, failures })
  }

  return {
    results,
    passed: results.filter((r) => r.pass).length,
    total: results.length,
  }
}
