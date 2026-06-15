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
import { hostFromUrl, isDomainAllowed } from '../lib/egress'
import { Pushable } from './pushable'

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
function runCommand(files: Map<string, string>, egress: string[], cmd: string): ExecResult {
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
    case 'node': {
      // SIMULATION ONLY: the mock does not execute JS. It reports a passing test run
      // when `node --test <file>` references a real, non-empty test file, so the agent
      // loop and artifacts can be exercised. Real execution happens on E2B/Daytona.
      if (rest[0] === '--test') {
        const testPath = normalizePath(rest[1] ?? '')
        const contents = files.get(testPath)
        if (contents && contents.trim().length > 0) {
          stdout =
            'TAP version 13\n' +
            'ok 1 - test passed (simulated by mock sandbox)\n' +
            '1..1\n# tests 1\n# pass 1\n# fail 0\n'
        } else {
          stderr = `node: could not find test file '${rest[1] ?? ''}'\n`
          exitCode = 1
        }
      } else {
        stderr = `[mock-sandbox] 'node' is simulated; only \`node --test <file>\` is supported\n`
        exitCode = 1
      }
      break
    }
    case 'curl':
    case 'wget': {
      // Egress is default-deny per sandbox (mission section 6.2). A non-allowlisted host
      // is blocked; an allowlisted one is permitted (network itself is simulated here).
      const target = rest.find((a) => /^https?:\/\//.test(a) || /\.[a-z]{2,}/i.test(a)) ?? ''
      const host = hostFromUrl(target)
      if (isDomainAllowed(host, egress)) {
        stdout = `[mock-sandbox] egress allowed to ${host} (simulated)\n`
      } else {
        stderr = `[mock-sandbox] egress blocked: ${host || target} is not on the allowlist\n`
        exitCode = 7
      }
      break
    }
    default:
      stderr = `[mock-sandbox] '${bin}' is not executable in the mock provider; use E2B/Daytona for real execution\n`
      exitCode = 127
  }

  return { exitCode, stdout, stderr, durationMs: Math.round(performance.now() - start) }
}

/** Terminals expect CRLF line endings; convert bare/Windows newlines to CRLF. */
function toCRLF(text: string): string {
  return text.replace(/\r?\n/g, '\r\n')
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
    const state = this.state(id)
    return runCommand(state.files, state.egress, cmd)
  }

  async writeFile(id: string, path: string, contents: string): Promise<void> {
    this.state(id).files.set(normalizePath(path), contents)
  }

  async readFile(id: string, path: string): Promise<string> {
    const contents = this.state(id).files.get(normalizePath(path))
    if (contents === undefined) throw new Error(`mock-sandbox: no such file '${path}'`)
    return contents
  }

  async deleteFile(id: string, path: string): Promise<void> {
    const normalized = normalizePath(path)
    const state = this.state(id)
    state.files.delete(normalized)
    
    // Recursively delete folder children
    const prefix = normalized + '/'
    for (const key of Array.from(state.files.keys())) {
      if (key.startsWith(prefix)) {
        state.files.delete(key)
      }
    }
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

    let lineBuffer = ''
    let lastWasCR = false

    function runLine(): void {
      stream.push('\r\n')
      const result = runCommand(state.files, state.egress, lineBuffer)
      lineBuffer = ''
      if (result.stdout) stream.push(toCRLF(result.stdout))
      if (result.stderr) stream.push(toCRLF(result.stderr))
      stream.push(prompt)
    }

    return {
      output: stream,
      // Behaves like a PTY line discipline: echoes input, treats CR/LF (and CRLF as
      // one) as Enter, and handles backspace. The terminal (xterm) sends CR on Enter.
      async write(data: string): Promise<void> {
        for (const ch of data) {
          if (ch === '\r') {
            runLine()
            lastWasCR = true
            continue
          }
          if (ch === '\n') {
            if (lastWasCR) {
              lastWasCR = false
              continue
            }
            runLine()
            continue
          }
          lastWasCR = false
          if (ch === '\u007f' || ch === '\b') {
            if (lineBuffer.length > 0) {
              lineBuffer = lineBuffer.slice(0, -1)
              stream.push('\b \b')
            }
          } else {
            lineBuffer += ch
            stream.push(ch)
          }
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
