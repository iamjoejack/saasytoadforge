import { randomUUID } from 'node:crypto'
import type {
  AsyncShellSession,
  CreateSandboxOptions,
  ExecOptions,
  ExecResult,
  FileEntry,
  Sandbox,
  SandboxProvider,
} from '@forge/shared'

/**
 * In-memory sandbox for development and tests. It models the workspace file system
 * and a tiny shell so the IDE round-trips (edit -> persist, command -> streamed output)
 * without any external service.
 *
 * It deliberately does NOT execute arbitrary code: real execution requires a
 * kernel/hardware-isolated provider (E2B microVM / Daytona gVisor). Unknown commands
 * report exit code 127 rather than faking success (see SECURITY in ARCHITECTURE.md).
 */

interface MockState {
  meta: Sandbox
  files: Map<string, string>
  egress: string[]
}

/** Workspace-relative path, no leading "./" or "/", collapsed slashes. */
function normalizePath(p: string): string {
  return p.replace(/^\.?\/+/, '').replace(/\/+/g, '/')
}

/** Minimal deterministic shell over the in-memory file system. */
function runCommand(files: Map<string, string>, cmd: string): ExecResult {
  const start = performance.now()
  const [bin = '', ...rest] = cmd.trim().split(/\s+/)
  let stdout = ''
  let stderr = ''
  let exitCode = 0

  switch (bin) {
    case '':
      break
    case 'echo':
      stdout = `${rest.join(' ')}\n`
      break
    case 'pwd':
      stdout = '/workspace\n'
      break
    case 'true':
      break
    case 'false':
      exitCode = 1
      break
    case 'ls': {
      const top = new Set<string>()
      for (const full of files.keys()) {
        const seg = full.split('/')[0]
        if (seg) top.add(seg)
      }
      stdout = [...top].sort().join('\n')
      if (stdout) stdout += '\n'
      break
    }
    case 'cat': {
      const target = normalizePath(rest[0] ?? '')
      const contents = files.get(target)
      if (contents === undefined) {
        stderr = `cat: ${rest[0] ?? ''}: No such file or directory\n`
        exitCode = 1
      } else {
        stdout = contents
      }
      break
    }
    default:
      stderr = `[mock-sandbox] '${bin}' is not executable in the mock provider; use E2B/Daytona for real execution\n`
      exitCode = 127
  }

  return { exitCode, stdout, stderr, durationMs: Math.round(performance.now() - start) }
}

/** Async stream that lets a producer push chunks to an `for await` consumer. */
class Pushable<T> implements AsyncIterable<T> {
  private readonly queue: T[] = []
  private readonly waiters: Array<(r: IteratorResult<T>) => void> = []
  private done = false

  push(item: T): void {
    const waiter = this.waiters.shift()
    if (waiter) {
      waiter({ value: item, done: false })
    } else {
      this.queue.push(item)
    }
  }

  end(): void {
    this.done = true
    let waiter = this.waiters.shift()
    while (waiter) {
      waiter({ value: undefined, done: true } as IteratorResult<T>)
      waiter = this.waiters.shift()
    }
  }

  [Symbol.asyncIterator](): AsyncIterator<T> {
    return {
      next: (): Promise<IteratorResult<T>> => {
        const queued = this.queue.shift()
        if (queued !== undefined) return Promise.resolve({ value: queued, done: false })
        if (this.done) return Promise.resolve({ value: undefined, done: true } as IteratorResult<T>)
        return new Promise((resolve) => this.waiters.push(resolve))
      },
    }
  }
}

export class MockSandboxProvider implements SandboxProvider {
  private readonly sandboxes = new Map<string, MockState>()

  private state(id: string): MockState {
    const s = this.sandboxes.get(id)
    if (!s) throw new Error(`mock-sandbox: unknown sandbox '${id}'`)
    return s
  }

  async create(opts: CreateSandboxOptions): Promise<Sandbox> {
    const id = `mock_${randomUUID()}`
    const meta: Sandbox = { id, template: opts.template, createdAt: new Date().toISOString() }
    this.sandboxes.set(id, { meta, files: new Map(), egress: [] })
    return meta
  }

  async exec(id: string, cmd: string, _opts?: ExecOptions): Promise<ExecResult> {
    return runCommand(this.state(id).files, cmd)
  }

  async writeFile(id: string, path: string, contents: string): Promise<void> {
    this.state(id).files.set(normalizePath(path), contents)
  }

  async readFile(id: string, path: string): Promise<string> {
    const contents = this.state(id).files.get(normalizePath(path))
    if (contents === undefined) throw new Error(`mock-sandbox: no such file '${path}'`)
    return contents
  }

  async listFiles(id: string, dir: string): Promise<FileEntry[]> {
    const files = this.state(id).files
    const prefix = normalizePath(dir)
    const base = prefix === '' ? '' : prefix.endsWith('/') ? prefix : `${prefix}/`
    const seenDirs = new Set<string>()
    const out: FileEntry[] = []

    for (const [full, contents] of files) {
      if (base !== '' && !full.startsWith(base)) continue
      const rest = full.slice(base.length)
      const slash = rest.indexOf('/')
      if (slash === -1) {
        out.push({ path: full, name: rest, type: 'file', size: contents.length })
      } else {
        const name = rest.slice(0, slash)
        if (!seenDirs.has(name)) {
          seenDirs.add(name)
          out.push({ path: `${base}${name}`, name, type: 'dir' })
        }
      }
    }

    return out.sort((a, b) =>
      a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'dir' ? -1 : 1,
    )
  }

  openShell(id: string): AsyncShellSession {
    const state = this.state(id)
    const stream = new Pushable<string>()
    const prompt = 'forge:/workspace$ '
    stream.push(prompt)
    let buffer = ''

    return {
      output: stream,
      async write(data: string): Promise<void> {
        buffer += data
        let nl = buffer.indexOf('\n')
        while (nl !== -1) {
          const line = buffer.slice(0, nl)
          buffer = buffer.slice(nl + 1)
          const result = runCommand(state.files, line)
          if (result.stdout) stream.push(result.stdout)
          if (result.stderr) stream.push(result.stderr)
          stream.push(prompt)
          nl = buffer.indexOf('\n')
        }
      },
      async resize(): Promise<void> {},
      async close(): Promise<void> {
        stream.end()
      },
    }
  }

  async setEgressAllowlist(id: string, domains: string[]): Promise<void> {
    this.state(id).egress = [...domains]
  }

  async destroy(id: string): Promise<void> {
    this.sandboxes.delete(id)
  }

  /** Test/inspection helper: the egress allowlist currently set on a sandbox. */
  getEgressAllowlist(id: string): string[] {
    return [...this.state(id).egress]
  }
}
