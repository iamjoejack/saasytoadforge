import { describe, it, expect } from 'vitest'
import { mintAgentToken, DEFAULT_AGENT_SERVICE_SECRET } from '@forge/shared'
import { buildServer } from '../server'
import { MockSandboxProvider } from '../sandbox'

function app() {
  return buildServer({ provider: new MockSandboxProvider() })
}

function auth(userId: string) {
  return { authorization: `Bearer ${mintAgentToken(userId, DEFAULT_AGENT_SERVICE_SECRET)}` }
}

const ALICE = auth('alice')

async function createWorkspace(server: ReturnType<typeof app>, headers = ALICE): Promise<string> {
  const res = await server.inject({ method: 'POST', url: '/workspaces', headers })
  expect(res.statusCode).toBe(200)
  return res.json<{ id: string }>().id
}

describe('workspace REST API', () => {
  it('creates a workspace seeded with starter files', async () => {
    const server = app()
    const id = await createWorkspace(server)
    expect(id).toMatch(/^mock_/)

    const files = await server.inject({ method: 'GET', url: `/workspaces/${id}/files`, headers: ALICE })
    const names = files.json<Array<{ name: string }>>().map((f) => f.name)
    expect(names).toEqual(expect.arrayContaining(['README.md', 'index.js', 'src']))
    await server.close()
  })

  it('round-trips an edit: PUT then GET (persistence proof)', async () => {
    const server = app()
    const id = await createWorkspace(server)
    const put = await server.inject({
      method: 'PUT',
      url: `/workspaces/${id}/file`,
      headers: ALICE,
      payload: { path: 'src/app.js', contents: 'export const answer = 42\n' },
    })
    expect(put.statusCode).toBe(200)

    const get = await server.inject({
      method: 'GET',
      url: `/workspaces/${id}/file?path=${encodeURIComponent('src/app.js')}`,
      headers: ALICE,
    })
    expect(get.json<{ contents: string }>().contents).toBe('export const answer = 42\n')
    await server.close()
  })

  it('execs a command in the sandbox', async () => {
    const server = app()
    const id = await createWorkspace(server)
    const res = await server.inject({
      method: 'POST',
      url: `/workspaces/${id}/exec`,
      headers: ALICE,
      payload: { cmd: 'echo forge' },
    })
    expect(res.json<{ stdout: string }>().stdout).toBe('forge\n')
    await server.close()
  })

  it('requires a valid token (401 without one)', async () => {
    const server = app()
    const res = await server.inject({ method: 'POST', url: '/workspaces' })
    expect(res.statusCode).toBe(401)
    const bad = await server.inject({
      method: 'POST',
      url: '/workspaces',
      headers: { authorization: 'Bearer garbage' },
    })
    expect(bad.statusCode).toBe(401)
    await server.close()
  })

  it('isolates tenants: another user cannot reach a workspace (404, not 403)', async () => {
    const server = app()
    const id = await createWorkspace(server, ALICE)
    const asBob = await server.inject({
      method: 'GET',
      url: `/workspaces/${id}/files`,
      headers: auth('bob'),
    })
    expect(asBob.statusCode).toBe(404)

    const bobList = await server.inject({ method: 'GET', url: '/workspaces', headers: auth('bob') })
    expect(bobList.json<unknown[]>()).toHaveLength(0)
    await server.close()
  })

  it('only lists the caller-owned workspaces', async () => {
    const server = app()
    await createWorkspace(server, ALICE)
    await createWorkspace(server, ALICE)
    const list = await server.inject({ method: 'GET', url: '/workspaces', headers: ALICE })
    expect(list.json<unknown[]>()).toHaveLength(2)
    await server.close()
  })

  it('deletes an owned workspace', async () => {
    const server = app()
    const id = await createWorkspace(server)
    const del = await server.inject({ method: 'DELETE', url: `/workspaces/${id}`, headers: ALICE })
    expect(del.statusCode).toBe(200)
    const after = await server.inject({ method: 'GET', url: `/workspaces/${id}/files`, headers: ALICE })
    expect(after.statusCode).toBe(404)
    await server.close()
  })

  it('404s for an unknown workspace', async () => {
    const server = app()
    const res = await server.inject({ method: 'GET', url: '/workspaces/nope/files', headers: ALICE })
    expect(res.statusCode).toBe(404)
    await server.close()
  })

  it('rejects path traversal with 400', async () => {
    const server = app()
    const id = await createWorkspace(server)
    const res = await server.inject({
      method: 'PUT',
      url: `/workspaces/${id}/file`,
      headers: ALICE,
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
      headers: ALICE,
      payload: { path: 'a.txt' },
    })
    expect(res.statusCode).toBe(400)
    await server.close()
  })
})
