import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect, vi } from 'vitest'
import type { SandboxProvider } from '@forge/shared'
import { MockSandboxProvider } from '../sandbox'
import { WorkspaceManager } from './manager'

/**
 * A green build says nothing about whether a server is listening. /deploy used to return
 * deployed:true and a port-3000 URL straight off a successful build, so the UI showed a
 * "Deployed" chip and an "Open app" link that led nowhere.
 */
describe('deploy only claims live after the port answers', () => {
  const server = readFileSync(join(__dirname, '../server.ts'), 'utf8')

  it('probes the app port before returning deployed', () => {
    expect(server).toMatch(/serveWorkspace\(provider, ws\.sandboxId\)/)
    expect(server).toMatch(/curl -sf -o \/dev\/null http:\/\/localhost:\$\{APP_PORT\}/)
  })

  it('returns not-deployed with the start log when nothing answers', () => {
    expect(server).toMatch(/if \(!serving\.ok\)/)
    expect(server).toMatch(/is not live yet/)
  })

  it('no longer announces a deployment straight off the build', () => {
    expect(server).not.toMatch(/Build verified\. Deployment is live\./)
  })
})

/**
 * Once provider.create resolves the microVM is live and billing. If seeding then throws, the
 * workspace is never recorded, so the sandbox is unreachable by its owner and invisible to
 * listAll() - an orphan nobody can find but the operator still pays for.
 */
describe('a failed seed does not leave a live sandbox behind', () => {
  it('destroys the sandbox when writing the starter files fails', async () => {
    const inner = new MockSandboxProvider()
    const destroy = vi.fn(async (id: string) => inner.destroy(id))
    const provider = {
      ...inner,
      create: (opts: Parameters<SandboxProvider['create']>[0]) => inner.create(opts),
      setEgressAllowlist: (id: string, d: string[]) => inner.setEgressAllowlist(id, d),
      writeFile: async () => {
        throw new Error('e2b write failed')
      },
      destroy,
    } as unknown as SandboxProvider

    const manager = new WorkspaceManager(provider, [])
    await expect(manager.create('alice')).rejects.toThrow('e2b write failed')

    expect(destroy).toHaveBeenCalledTimes(1)
    // And the half-built workspace is not recorded as if it were usable.
    expect(manager.list('alice')).toEqual([])
    expect(manager.listAll()).toEqual([])
  })

  it('a clean create still registers the workspace', async () => {
    const manager = new WorkspaceManager(new MockSandboxProvider(), [])
    const ws = await manager.create('alice')
    expect(manager.get(ws.id, 'alice')).toEqual(ws)
    expect(manager.listAll()).toHaveLength(1)
  })
})
