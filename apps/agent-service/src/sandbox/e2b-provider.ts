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
import { assertSafePath } from '../lib/paths'

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
    await this.get(id).files.write(assertSafePath(path), contents)
  }

  async readFile(id: string, path: string): Promise<string> {
    return this.get(id).files.read(assertSafePath(path))
  }

  async deleteFile(id: string, path: string): Promise<void> {
    await this.exec(id, `rm -rf "${assertSafePath(path)}"`)
  }

  async listFiles(id: string, dir: string): Promise<FileEntry[]> {
    const entries = await this.get(id).files.list(dir ? assertSafePath(dir) : '.')
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

  async checkpoint(id: string): Promise<string> {
    // Shadow git: GIT_DIR/GIT_WORK_TREE point at a private repo so we never create a .git
    // in the workspace or touch any real history the project may have. node_modules and
    // build output are excluded so snapshots stay fast. Returns the commit SHA as the ref.
    const cmd = `sh -c '
      export GIT_DIR="$HOME/.forge-shadow.git" GIT_WORK_TREE="$HOME"
      if [ ! -d "$GIT_DIR" ]; then
        git init -q
        git config user.email forge@saasytoad.local
        git config user.name "Forge"
        mkdir -p "$GIT_DIR/info"
        printf "node_modules/\\n.next/\\ndist/\\n.cache/\\n.git/\\n" > "$GIT_DIR/info/exclude"
      fi
      git add -A
      git commit -q --allow-empty -m "forge checkpoint" >/dev/null 2>&1 || true
      git rev-parse HEAD
    '`
    const res = await this.exec(id, cmd)
    const ref = res.stdout.trim()
    if (res.exitCode !== 0 || !ref) {
      throw new Error(`e2b checkpoint failed: ${res.stderr || res.stdout || 'no commit'}`)
    }
    return ref
  }

  async restore(id: string, ref: string): Promise<void> {
    // ref is always a commit SHA we produced; reject anything else so it can't be used for
    // shell injection.
    if (!/^[0-9a-f]{7,40}$/.test(ref)) throw new Error('e2b restore: invalid checkpoint ref')
    const cmd = `sh -c 'export GIT_DIR="$HOME/.forge-shadow.git" GIT_WORK_TREE="$HOME"; git reset --hard ${ref} -q'`
    const res = await this.exec(id, cmd)
    if (res.exitCode !== 0) throw new Error(`e2b restore failed: ${res.stderr || res.stdout}`)
  }

  async destroy(id: string): Promise<void> {
    const sbx = this.sandboxes.get(id)
    if (!sbx) return
    await sbx.kill()
    this.sandboxes.delete(id)
  }
}
