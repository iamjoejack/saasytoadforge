import type { AgentEvent, SandboxProvider } from '@forge/shared'
import { parseServerEnv } from '@forge/shared'
import { MockSandboxProvider, createSandboxProvider } from '../sandbox'
import { Agent, ApprovalGate, QuestionGate } from '../agent/agent'
import { MockPlanner, type Planner } from '../agent/planner'
import { runAgentic } from '../agent/agentic'
import { createLlmClient, type LlmClient } from '../agent/llm'
import { modelFor } from '../agent/router'
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
  /** Which LLM client drove the run. 'mock' means no real model was configured. */
  llmKind?: string
  /** Which sandbox executed. 'mock' means code did not really run. */
  sandboxKind?: string
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
      {
        task: evalCase.task,
        planner: makePlanner(),
        approvals: new ApprovalGate(),
        questions: new QuestionGate(),
      },
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

export interface AgenticEvalOptions {
  /** Override the LLM client (defaults to the env-resolved client). */
  makeLlm?: () => LlmClient
  /** Override the sandbox provider (defaults to the env-resolved provider). */
  makeProvider?: () => SandboxProvider
  /** Override the model id (defaults to the frontier tier from env). */
  model?: string
  maxSteps?: number
}

/**
 * Runs each eval case through the REAL agentic loop (`runAgentic`). With a model key and
 * E2B configured, this is the actual task-completion scoreboard. With no key it runs on the
 * mock LLM, which cannot complete tasks, so the score is honestly near zero. The report
 * carries `llmKind` and `sandboxKind` so a run never looks more real than it is.
 */
export async function runAgenticEval(
  cases: EvalCase[] = EVAL_CASES,
  opts: AgenticEvalOptions = {},
): Promise<EvalReport> {
  const env = parseServerEnv(process.env)
  const makeLlm = opts.makeLlm ?? (() => createLlmClient(env))
  const makeProvider = opts.makeProvider ?? (() => createSandboxProvider(env))
  const model = opts.model ?? modelFor(env, 'frontier')

  const results: EvalResult[] = []
  let llmKind = 'unknown'
  let sandboxKind = 'unknown'

  for (const evalCase of cases) {
    const provider = makeProvider()
    sandboxKind = provider instanceof MockSandboxProvider ? 'mock' : 'e2b'
    const sandbox = await provider.create({ template: 'node', envAllowlist: [] })
    const tools = createToolSet(provider, sandbox.id, new MockBrowserTool())
    const llm = makeLlm()
    llmKind = llm.kind
    const events: AgentEvent[] = []

    await runAgentic(
      {
        task: evalCase.task,
        llm,
        model,
        tools,
        approvals: new ApprovalGate(),
        questions: new QuestionGate(),
        history: [],
        maxSteps: opts.maxSteps,
      },
      (e) => events.push(e),
    )

    const failures = evalCase.check(events)
    results.push({ name: evalCase.name, pass: failures.length === 0, failures })
  }

  return {
    results,
    passed: results.filter((r) => r.pass).length,
    total: results.length,
    llmKind,
    sandboxKind,
  }
}
