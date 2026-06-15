import type { ServerEnv } from '@forge/shared'
import type { LlmClient } from './llm'
import { modelFor } from './router'

export type AgentAction =
  | { kind: 'message'; text: string }
  | { kind: 'plan'; steps: Array<{ id: string; title: string }> }
  | { kind: 'edit'; stepId?: string; path: string; contents: string }
  | { kind: 'run'; stepId?: string; cmd: string }
  | { kind: 'approval'; stepId?: string; action: string; detail: string }

export interface Planner {
  plan(task: string): Promise<AgentAction[]>
  readonly kind: 'mock' | 'llm'
}

const TIME_ENDPOINT = `export function currentTime() {
  return new Date().toISOString()
}

export function timeHandler(_req, res) {
  res.statusCode = 200
  res.setHeader('content-type', 'application/json')
  res.end(JSON.stringify({ now: currentTime() }))
}
`

const TIME_TEST = `import { test } from 'node:test'
import assert from 'node:assert/strict'
import { currentTime } from '../src/time.mjs'

test('currentTime returns an ISO 8601 string', () => {
  assert.match(currentTime(), /^\\d{4}-\\d{2}-\\d{2}T/)
})
`

/** Deterministic planner used until OPENROUTER_API_KEY is supplied. */
export class MockPlanner implements Planner {
  readonly kind = 'mock' as const

  async plan(task: string): Promise<AgentAction[]> {
    if (/\btime\b/i.test(task)) {
      return [
        { kind: 'message', text: 'On it. I will add a current-time endpoint, a test, then run it.' },
        {
          kind: 'plan',
          steps: [
            { id: 's1', title: 'Add a current-time endpoint' },
            { id: 's2', title: 'Add a test for it' },
            { id: 's3', title: 'Run the test' },
          ],
        },
        { kind: 'edit', stepId: 's1', path: 'src/time.mjs', contents: TIME_ENDPOINT },
        { kind: 'edit', stepId: 's2', path: 'test/time.test.mjs', contents: TIME_TEST },
        { kind: 'run', stepId: 's3', cmd: 'node --test test/time.test.mjs' },
      ]
    }

    // Generic fallback: record the request so the loop still produces real artifacts.
    return [
      { kind: 'message', text: `Noting your request: "${task}".` },
      { kind: 'plan', steps: [{ id: 's1', title: 'Record the request in NOTES.md' }] },
      {
        kind: 'edit',
        stepId: 's1',
        path: 'NOTES.md',
        contents: `# Notes\n\n- ${task}\n`,
      },
    ]
  }
}

const SYSTEM_PROMPT = `You are Forge, a coding agent working inside an isolated sandbox.
Return ONLY JSON of the form:
{"message": string, "steps": [{"id": string, "title": string}],
 "actions": [{"kind":"edit","stepId":string,"path":string,"contents":string}
            |{"kind":"run","stepId":string,"cmd":string}]}
Edit whole-file contents. Prefer running tests to verify. No prose outside the JSON.`

interface PlanJson {
  message?: string
  steps?: Array<{ id: string; title: string }>
  actions?: Array<
    | { kind: 'edit'; stepId?: string; path: string; contents: string }
    | { kind: 'run'; stepId?: string; cmd: string }
  >
}

/** Parses a structured plan from any LLM; the real model is a drop-in. */
export class LlmPlanner implements Planner {
  readonly kind = 'llm' as const

  constructor(
    private readonly llm: LlmClient,
    private readonly model: string,
  ) {}

  async plan(task: string): Promise<AgentAction[]> {
    const raw = await this.llm.complete({
      model: this.model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: task },
      ],
    })
    return parsePlan(raw)
  }
}

export function parsePlan(raw: string): AgentAction[] {
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start === -1 || end <= start) {
    throw new Error('planner: no JSON object in model output')
  }
  const parsed = JSON.parse(raw.slice(start, end + 1)) as PlanJson

  const actions: AgentAction[] = []
  if (parsed.message) actions.push({ kind: 'message', text: parsed.message })
  if (parsed.steps?.length) actions.push({ kind: 'plan', steps: parsed.steps })
  for (const action of parsed.actions ?? []) {
    if (action.kind === 'edit' && typeof action.path === 'string') {
      actions.push({ kind: 'edit', stepId: action.stepId, path: action.path, contents: action.contents })
    } else if (action.kind === 'run' && typeof action.cmd === 'string') {
      actions.push({ kind: 'run', stepId: action.stepId, cmd: action.cmd })
    }
  }
  return actions
}

export function createPlanner(env: ServerEnv, llm: LlmClient): Planner {
  if (llm.kind === 'openrouter') return new LlmPlanner(llm, modelFor(env, 'frontier'))
  return new MockPlanner()
}
