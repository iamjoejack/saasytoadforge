import { describe, it, expect } from 'vitest'
import { reviewWorkspace } from './ronald'
import { MockSandboxProvider } from '../sandbox/mock-provider'
import type { LlmClient, CompleteOptions } from './llm'

async function seed(files: Record<string, string>) {
  const provider = new MockSandboxProvider()
  const sandbox = await provider.create({ template: 'node', envAllowlist: [] })
  for (const [path, contents] of Object.entries(files)) {
    await provider.writeFile(sandbox.id, path, contents)
  }
  return { provider, sandboxId: sandbox.id }
}

describe('reviewWorkspace', () => {
  it('skips build/test on the mock sandbox and is ready when nothing fails', async () => {
    const { provider, sandboxId } = await seed({
      'package.json': JSON.stringify({
        name: 'demo',
        scripts: { build: 'tsc', test: 'vitest run', typecheck: 'tsc --noEmit', lint: 'eslint .' },
      }),
      'test/a.test.mjs': "import {test} from 'node:test'\ntest('ok', () => {})\n",
      'src/index.mjs': 'export const hello = () => "hi"\n',
    })

    const verdict = await reviewWorkspace(provider, sandboxId)

    expect(verdict.ready).toBe(true)
    const build = verdict.checks.find((c) => c.name === 'Build')
    expect(build?.status).toBe('skip') // mock cannot run npm
    expect(verdict.checks.find((c) => c.name === 'Test coverage')?.status).toBe('pass')
    expect(verdict.summary.toLowerCase()).toContain('mock sandbox')
    expect(verdict.score).toBeGreaterThan(0)
  })

  it('flags a missing package.json and missing tests', async () => {
    const { provider, sandboxId } = await seed({
      'index.html': '<h1>hi</h1>',
    })

    const verdict = await reviewWorkspace(provider, sandboxId)

    expect(verdict.checks.find((c) => c.name === 'Project manifest')?.status).toBe('warn')
    expect(verdict.checks.find((c) => c.name === 'Test coverage')?.status).toBe('warn')
    expect(verdict.recommendations.some((r) => /package\.json/i.test(r))).toBe(true)
  })

  it('warns about committed .env files and leftover markers', async () => {
    const { provider, sandboxId } = await seed({
      'package.json': JSON.stringify({ name: 'x', scripts: {} }),
      '.env': 'SECRET=abc',
      'src/app.ts': '// TODO: finish this\nexport const x = 1\n',
    })

    const verdict = await reviewWorkspace(provider, sandboxId)

    expect(verdict.checks.find((c) => c.name === 'Secrets')?.status).toBe('warn')
    expect(verdict.checks.find((c) => c.name === 'Leftover markers')?.status).toBe('warn')
  })

  it('treats model-reported blockers as not-ready', async () => {
    const scripted: LlmClient = {
      kind: 'anthropic',
      async complete(_opts: CompleteOptions) {
        return '{"blockers":["The auth check is bypassable."],"recommendations":["Add rate limiting."],"summary":"Risky."}'
      },
    }
    const { provider, sandboxId } = await seed({
      'package.json': JSON.stringify({ name: 'x', scripts: {} }),
      'src/auth.ts': 'export const checkAuth = () => true\n',
      'test/a.test.mjs': "import {test} from 'node:test'\ntest('ok', () => {})\n",
    })

    const verdict = await reviewWorkspace(provider, sandboxId, {
      llm: scripted,
      model: 'claude-sonnet-4-5',
    })

    expect(verdict.ready).toBe(false)
    expect(verdict.blockers.some((b) => /auth check/i.test(b))).toBe(true)
    expect(verdict.checks.some((c) => c.name === 'Code review' && c.status === 'fail')).toBe(true)
  })
})
