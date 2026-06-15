import { Sandbox, CommandExitError, FileType } from 'e2b'
import type {
  AsyncShellSession,
  CreateSandboxOptions,
  ExecOptions,
  ExecResult,
  FileEntry,
  Sandbox as ForgeSandbox,
  SandboxProvider,
} from '@forge/shared'
import { Pushable } from './pushable'

const DEFAULT_TEMPLATE = 'base'
const DEFAULT_SANDBOX_TIMEOUT_MS = 5 * 60_000

/**
 * Real microVM sandbox via E2B (Firecracker). Untrusted/agent code runs here, never on the
 * host. Egress policy is enforced by E2B at the microVM/template firewall level.
 */
export class E2BSandboxProvider implements SandboxProvider {
  private readonly sandboxes = new Map<string, Sandbox>()

  constructor(private readonly apiKey: string) {}

  private get(id: string): Sandbox {
    const sbx = this.sandboxes.get(id)
    if (!sbx) throw new Error(`e2b-sandbox: unknown sandbox '${id}'`)
    return sbx
  }

  async create(opts: CreateSandboxOptions): Promise<ForgeSandbox> {
    const template = opts.template || DEFAULT_TEMPLATE
    const sbx = await Sandbox.create(template, {
      apiKey: this.apiKey,
      timeoutMs: DEFAULT_SANDBOX_TIMEOUT_MS,
    })
    this.sandboxes.set(sbx.sandboxId, sbx)
    return { id: sbx.sandboxId, template, createdAt: new Date().toISOString() }
  }

  async exec(id: string, cmd: string, opts?: ExecOptions): Promise<ExecResult> {
    const sbx = this.get(id)
    const start = performance.now()
    try {
      const res = await sbx.commands.run(cmd, { timeoutMs: opts?.timeoutMs ?? 60_000 })
      return {
        exitCode: res.exitCode,
        stdout: res.stdout,
        stderr: res.stderr,
        durationMs: Math.round(performance.now() - start),
      }
    } catch (err) {
      if (err instanceof CommandExitError) {
        return {
          exitCode: err.exitCode,
          stdout: err.stdout,
          stderr: err.stderr,
          durationMs: Math.round(performance.now() - start),
        }
      }
      throw err
    }
  }

  async writeFile(id: string, path: string, contents: string): Promise<void> {
    await this.get(id).files.write(path, contents)
  }

  async readFile(id: string, path: string): Promise<string> {
    return this.get(id).files.read(path)
  }

  async listFiles(id: string, dir: string): Promise<FileEntry[]> {
    const entries = await this.get(id).files.list(dir || '.')
    return entries.map((entry) => ({
      path: entry.path,
      name: entry.name,
      type: entry.type === FileType.DIR ? 'dir' : 'file',
      size: entry.size,
    }))
  }

  openShell(id: string): AsyncShellSession {
    const sbx = this.get(id)
    const stream = new Pushable<string>()
    const decoder = new TextDecoder()
    const encoder = new TextEncoder()
    let pid: number | null = null
    const pending: string[] = []

    const handle = sbx.pty
      .create({
        cols: 80,
        rows: 24,
        onData: (data: Uint8Array) => stream.push(decoder.decode(data)),
      })
      .then((h) => {
        pid = h.pid
        for (const data of pending) void sbx.pty.sendInput(pid, encoder.encode(data))
        pending.length = 0
        return h
      })
      .catch((err: unknown) => {
        stream.push(`\r\n[forge] shell error: ${String(err)}\r\n`)
        return null
      })

    return {
      output: stream,
      async write(data: string): Promise<void> {
        if (pid !== null) await sbx.pty.sendInput(pid, encoder.encode(data))
        else pending.push(data)
      },
      async resize(cols: number, rows: number): Promise<void> {
        if (pid !== null) await sbx.pty.resize(pid, { cols, rows })
      },
      async close(): Promise<void> {
        await handle
        if (pid !== null) await sbx.pty.kill(pid)
        stream.end()
      },
    }
  }

  async setEgressAllowlist(_id: string, _domains: string[]): Promise<void> {
    // E2B enforces network policy at the microVM/template firewall level, not per call.
  }

  async destroy(id: string): Promise<void> {
    const sbx = this.sandboxes.get(id)
    if (!sbx) return
    await sbx.kill()
    this.sandboxes.delete(id)
  }
}
