import { describe, it, expect } from 'vitest'
import { parseServerEnv } from '@forge/shared'
import { MockSandboxProvider, createSandboxProvider } from './index'

async function freshSandbox() {
  const provider = new MockSandboxProvider()
  const sandbox = await provider.create({ template: 'node', envAllowlist: [] })
  return { provider, sandbox }
}

describe('MockSandboxProvider', () => {
  it('creates a sandbox with id, template, and timestamp', async () => {
    const { sandbox } = await freshSandbox()
    expect(sandbox.id).toMatch(/^mock_/)
    expect(sandbox.template).toBe('node')
    expect(() => new Date(sandbox.createdAt).toISOString()).not.toThrow()
  })

  it('round-trips a file write -> read', async () => {
    const { provider, sandbox } = await freshSandbox()
    await provider.writeFile(sandbox.id, 'src/index.ts', 'export const x = 1\n')
    expect(await provider.readFile(sandbox.id, 'src/index.ts')).toBe('export const x = 1\n')
  })

  it('normalizes leading ./ and / on paths', async () => {
    const { provider, sandbox } = await freshSandbox()
    await provider.writeFile(sandbox.id, './a.txt', 'A')
    expect(await provider.readFile(sandbox.id, '/a.txt')).toBe('A')
  })

  it('throws reading a missing file', async () => {
    const { provider, sandbox } = await freshSandbox()
    await expect(provider.readFile(sandbox.id, 'nope.txt')).rejects.toThrow(/no such file/)
  })

  it('execs echo and cat, and reports unknown commands honestly', async () => {
    const { provider, sandbox } = await freshSandbox()
    const echo = await provider.exec(sandbox.id, 'echo hello world')
    expect(echo.exitCode).toBe(0)
    expect(echo.stdout).toBe('hello world\n')

    await provider.writeFile(sandbox.id, 'readme.md', '# hi')
    const cat = await provider.exec(sandbox.id, 'cat readme.md')
    expect(cat.stdout).toBe('# hi')

    const bad = await provider.exec(sandbox.id, 'rm -rf /')
    expect(bad.exitCode).toBe(127)
    expect(bad.stderr).toMatch(/not executable in the mock provider/)
  })

  it('lists immediate children as files and dirs', async () => {
    const { provider, sandbox } = await freshSandbox()
    await provider.writeFile(sandbox.id, 'package.json', '{}')
    await provider.writeFile(sandbox.id, 'src/index.ts', '')
    await provider.writeFile(sandbox.id, 'src/lib/util.ts', '')

    const root = await provider.listFiles(sandbox.id, '')
    expect(root.map((e) => `${e.type}:${e.name}`)).toEqual(['dir:src', 'file:package.json'])

    const src = await provider.listFiles(sandbox.id, 'src')
    expect(src.map((e) => `${e.type}:${e.name}`)).toEqual(['dir:lib', 'file:index.ts'])
  })

  it('streams shell output: prompt, command result, next prompt', async () => {
    const { provider, sandbox } = await freshSandbox()
    const shell = provider.openShell(sandbox.id)
    const iterator = shell.output[Symbol.asyncIterator]()

    const firstPrompt = await iterator.next()
    expect(firstPrompt.value).toContain('$')

    await shell.write('echo streamed\n')
    const output = await iterator.next()
    expect(output.value).toBe('streamed\n')

    const nextPrompt = await iterator.next()
    expect(nextPrompt.value).toContain('$')

    await shell.close()
  })

  it('stores the egress allowlist and clears state on destroy', async () => {
    const { provider, sandbox } = await freshSandbox()
    await provider.setEgressAllowlist(sandbox.id, ['registry.npmjs.org', 'pypi.org'])
    expect(provider.getEgressAllowlist(sandbox.id)).toEqual(['registry.npmjs.org', 'pypi.org'])

    await provider.destroy(sandbox.id)
    await expect(provider.readFile(sandbox.id, 'x')).rejects.toThrow(/unknown sandbox/)
  })
})

describe('createSandboxProvider', () => {
  it('returns the mock provider by default', () => {
    const provider = createSandboxProvider(parseServerEnv({}))
    expect(provider).toBeInstanceOf(MockSandboxProvider)
  })

  it('falls back to mock when e2b is selected without a key', () => {
    const env = parseServerEnv({ SANDBOX_PROVIDER: 'e2b' } as NodeJS.ProcessEnv)
    expect(createSandboxProvider(env)).toBeInstanceOf(MockSandboxProvider)
  })
})
