/**
 * The sandbox abstraction. Untrusted / agent-generated code runs ONLY through a
 * SandboxProvider (see SECURITY in ARCHITECTURE.md). The host control plane never
 * executes untrusted code. Default implementation targets microVM/gVisor isolation;
 * the interface stays clean so E2B, Daytona, or WebContainers can swap in.
 */

export interface ExecResult {
  exitCode: number
  stdout: string
  stderr: string
  durationMs: number
}

export interface FileEntry {
  /** Path relative to the sandbox workspace root. */
  path: string
  name: string
  type: 'file' | 'dir'
  size?: number
}

export interface Sandbox {
  id: string
  template: string
  /** ISO 8601 creation timestamp. */
  createdAt: string
}

export interface CreateSandboxOptions {
  template: string
  /** Environment variable names allowed to be injected into the sandbox. */
  envAllowlist: string[]
}

export interface ExecOptions {
  timeoutMs?: number
}

/** A live, streamed shell session bridged to the editor terminal (xterm). */
export interface AsyncShellSession {
  /** Stream of raw terminal output chunks. */
  output: AsyncIterable<string>
  /** Write user keystrokes / commands into the shell. */
  write(data: string): Promise<void>
  /** Resize the pseudo-terminal. */
  resize(cols: number, rows: number): Promise<void>
  close(): Promise<void>
}

export interface SandboxProvider {
  create(opts: CreateSandboxOptions): Promise<Sandbox>
  exec(id: string, cmd: string, opts?: ExecOptions): Promise<ExecResult>
  writeFile(id: string, path: string, contents: string): Promise<void>
  readFile(id: string, path: string): Promise<string>
  deleteFile(id: string, path: string): Promise<void>
  listFiles(id: string, dir: string): Promise<FileEntry[]>
  /** Streamed to the xterm terminal. */
  openShell(id: string): AsyncShellSession
  /** Default-deny egress; only these domains (plus package registries) are reachable. */
  setEgressAllowlist(id: string, domains: string[]): Promise<void>
  destroy(id: string): Promise<void>
}
