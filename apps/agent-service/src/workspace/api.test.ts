import { describe, it, expect } from 'vitest'
import { buildServer } from '../server'
import { MockSandboxProvider } from '../sandbox'

function app() {
  return buildServer({ provider: new MockSandboxProvider() })
}

async function createWorkspace(server: ReturnType<typeof app>): Promise<string> {
  const res = await server.inject({ method: 'POST', url: '/workspaces' })
  expect(res.statusCode).toBe(200)
  return res.json<{ id: string }>().id
}

describe('workspace REST API', () => {
  it('creates a workspace seeded with starter files', async () => {
    const server = app()
    const id = await createWorkspace(server)
    expect(id).toMatch(/^mock_/)

    const files = await server.inject({ method: 'GET', url: `/workspaces/${id}/files` })
    const names = files.json<Array<{ name: string }>>().map((f) => f.name)
    expect(names).toContain('README.md')
    expect(names).toContain('index.js')
    expect(names).toContain('src')
    await server.close()
  })

  it('round-trips an edit: PUT file then GET reads it back (persistence proof)', async () => {
    const server = app()
    const id = await createWorkspace(server)

    const put = await server.inject({
      method: 'PUT',
      url: `/workspaces/${id}/file`,
      payload: { path: 'src/app.js', contents: 'export const answer = 42\n' },
    })
    expect(put.statusCode).toBe(200)
    expect(put.json<{ path: string }>().path).toBe('src/app.js')

    const get = await server.inject({
      method: 'GET',
      url: `/workspaces/${id}/file?path=${encodeURIComponent('src/app.js')}`,
    })
    expect(get.statusCode).toBe(200)
    expect(get.json<{ contents: string }>().contents).toBe('export const answer = 42\n')
    await server.close()
  })

  it('execs a command in the sandbox', async () => {
    const server = app()
    const id = await createWorkspace(server)
    const res = await server.inject({
      method: 'POST',
      url: `/workspaces/${id}/exec`,
      payload: { cmd: 'echo forge' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json<{ stdout: string }>().stdout).toBe('forge\n')
    await server.close()
  })

  it('404s for an unknown workspace', async () => {
    const server = app()
    const res = await server.inject({ method: 'GET', url: '/workspaces/nope/files' })
    expect(res.statusCode).toBe(404)
    await server.close()
  })

  it('rejects path traversal with 400', async () => {
    const server = app()
    const id = await createWorkspace(server)
    const res = await server.inject({
      method: 'PUT',
      url: `/workspaces/${id}/file`,
      payload: { path: '../../etc/passwd', contents: 'x' },
    })
    expect(res.statusCode).toBe(400)
    await server.close()
  })

  it('400s when path or contents are missing on write', async () => {
    const server = app()
    const id = await createWorkspace(server)
    const res = await server.inject({
      method: 'PUT',
      url: `/workspaces/${id}/file`,
      payload: { path: 'a.txt' },
    })
    expect(res.statusCode).toBe(400)
    await server.close()
  })
})
