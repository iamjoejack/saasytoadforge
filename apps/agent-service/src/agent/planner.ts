import type { AgentRole, ServerEnv } from '@forge/shared'
import type { LlmClient } from './llm'
import { modelFor } from './router'

export type AgentAction =
  | { kind: 'message'; text: string; agent?: AgentRole }
  | { kind: 'plan'; steps: Array<{ id: string; title: string; role?: AgentRole }> }
  | { kind: 'edit'; stepId?: string; path: string; contents: string; agent?: AgentRole }
  | { kind: 'run'; stepId?: string; cmd: string; agent?: AgentRole }
  | { kind: 'screenshot'; stepId?: string; path: string; label: string; agent?: AgentRole }
  | { kind: 'approval'; stepId?: string; action: string; detail: string; agent?: AgentRole }

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

const GREETING_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Greeting</title>
    <style>
      body { margin: 0; height: 100vh; display: grid; place-items: center;
        background: #0a0a0b; color: #ededed; font-family: ui-sans-serif, system-ui, sans-serif; }
      .card { text-align: center; }
      h1 { font-size: 44px; margin: 0 0 14px; letter-spacing: -0.02em; }
      p { color: #8a8f98; margin: 0 0 26px; }
      button { background: #c8a24a; color: #0a0a0b; border: 0; border-radius: 8px;
        padding: 12px 22px; font-size: 15px; font-weight: 600; cursor: pointer; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>Hello from Forge</h1>
      <p>A page Ronald built for you.</p>
      <button>Say hi</button>
    </div>
  </body>
</html>
`

const GREET_MODULE = `export function greet(name) {
  return \`hi \${name}\`
}
`

const GREET_TEST = `import { test } from 'node:test'
import assert from 'node:assert/strict'
import { greet } from '../src/greet.mjs'

test('greet builds a greeting', () => {
  assert.equal(greet('Forge'), 'hi Forge')
})
`

/** Deterministic planner used until OPENROUTER_API_KEY is supplied. */
export class MockPlanner implements Planner {
  readonly kind = 'mock' as const

  async plan(task: string): Promise<AgentAction[]> {
    if (/\b(page|landing|button|component|site|ui|html|screenshot)\b/i.test(task)) {
      return [
        {
          kind: 'message',
          agent: 'orchestrator',
          text: 'Breaking this down: coder builds the page, verifier tests it, browser captures a screenshot.',
        },
        {
          kind: 'plan',
          steps: [
            { id: 's1', title: 'Create the greeting page', role: 'coder' },
            { id: 's2', title: 'Add the greeting module', role: 'coder' },
            { id: 's3', title: 'Add and run a test', role: 'verifier' },
            { id: 's4', title: 'Capture a screenshot', role: 'browser' },
          ],
        },
        { kind: 'edit', stepId: 's1', agent: 'coder', path: 'public/index.html', contents: GREETING_HTML },
        { kind: 'edit', stepId: 's2', agent: 'coder', path: 'src/greet.mjs', contents: GREET_MODULE },
        { kind: 'edit', stepId: 's3', agent: 'verifier', path: 'test/greet.test.mjs', contents: GREET_TEST },
        { kind: 'run', stepId: 's3', agent: 'verifier', cmd: 'node --test test/greet.test.mjs' },
        { kind: 'screenshot', stepId: 's4', agent: 'browser', path: 'public/index.html', label: 'Greeting page' },
      ]
    }

    if (/\btime\b/i.test(task)) {
      return [
        {
          kind: 'message',
          agent: 'coder',
          text: 'On it. I will add a current-time endpoint, a test, then run it.',
        },
        {
          kind: 'plan',
          steps: [
            { id: 's1', title: 'Add a current-time endpoint', role: 'coder' },
            { id: 's2', title: 'Add a test for it', role: 'verifier' },
            { id: 's3', title: 'Run the test', role: 'verifier' },
          ],
        },
        { kind: 'edit', stepId: 's1', agent: 'coder', path: 'src/time.mjs', contents: TIME_ENDPOINT },
        { kind: 'edit', stepId: 's2', agent: 'verifier', path: 'test/time.test.mjs', contents: TIME_TEST },
        { kind: 'run', stepId: 's3', agent: 'verifier', cmd: 'node --test test/time.test.mjs' },
      ]
    }

    return [
      { kind: 'message', text: `Noting your request: "${task}".` },
      { kind: 'plan', steps: [{ id: 's1', title: 'Record the request in NOTES.md' }] },
      { kind: 'edit', stepId: 's1', path: 'NOTES.md', contents: `# Notes\n\n- ${task}\n` },
    ]
  }
}

const SYSTEM_PROMPT = `You are Forge, a coding agent working inside an isolated sandbox.
Return ONLY JSON of the form:
{"message": string, "steps": [{"id": string, "title": string, "role"?: string}],
 "actions": [{"kind":"edit","stepId":string,"path":string,"contents":string}
            |{"kind":"run","stepId":string,"cmd":string}
            |{"kind":"screenshot","stepId":string,"path":string,"label":string}]}
Edit whole-file contents. Run tests to verify. Screenshot HTML pages you build. No prose outside the JSON.`

interface PlanJson {
  message?: string
  steps?: Array<{ id: string; title: string; role?: AgentRole }>
  actions?: Array<Record<string, unknown>>
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

  for (const raw of parsed.actions ?? []) {
    const stepId = typeof raw.stepId === 'string' ? raw.stepId : undefined
    if (raw.kind === 'edit' && typeof raw.path === 'string' && typeof raw.contents === 'string') {
      actions.push({ kind: 'edit', stepId, path: raw.path, contents: raw.contents })
    } else if (raw.kind === 'run' && typeof raw.cmd === 'string') {
      actions.push({ kind: 'run', stepId, cmd: raw.cmd })
    } else if (raw.kind === 'screenshot' && typeof raw.path === 'string') {
      const label = typeof raw.label === 'string' ? raw.label : raw.path
      actions.push({ kind: 'screenshot', stepId, path: raw.path, label })
    }
  }
  return actions
}

export function createPlanner(env: ServerEnv, llm: LlmClient): Planner {
  if (llm.kind === 'openrouter') return new LlmPlanner(llm, modelFor(env, 'frontier'))
  return new MockPlanner()
}
