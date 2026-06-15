import type { AgentEvent } from '@forge/shared'
import type { LlmClient, LlmMessage } from './llm'
import type { ToolSet } from './tools'
import type { ApprovalGate } from './agent'
import { unifiedDiff } from './diff'

/**
 * A provider-agnostic agentic loop. The model either calls a tool (by replying with a
 * single JSON object) or answers the user in prose. This is the same surface Claude Code
 * works with: read, write, list, run a command, screenshot, then finish. Because a prose
 * reply ends the turn, the same loop doubles as a normal chat.
 *
 * The protocol is plain text over the existing streaming `complete()` method, so it works
 * for any backend (Anthropic, Google, OpenRouter) without provider-specific tool APIs.
 */

const KNOWN_TOOLS = new Set(['read_file', 'write_file', 'list_dir', 'run', 'screenshot', 'finish'])

const MAX_OBSERVATION_CHARS = 6000

export const AGENTIC_SYSTEM_PROMPT = `You are Ronald, the SaaSyToad Forge coding agent, working inside an isolated sandbox workspace.

You can use tools to inspect and change the workspace. To call a tool, reply with ONLY a single JSON object, nothing else:
{"thought": "<one short sentence on why>", "tool": "<name>", "args": { ... }}

Tools:
- read_file   args: { "path": string }                      read a workspace file
- list_dir    args: { "path": string }                      list a directory ("" for the root)
- write_file  args: { "path": string, "contents": string }  create or overwrite a whole file
- run         args: { "cmd": string }                        run a shell command (tests, build, grep, etc.)
- screenshot  args: { "path": string, "label": string }      render an HTML file and capture it
- finish      args: { "summary": string }                    end the task with a short summary

Rules:
- Work in small steps. Read or list before you edit. After editing code, run the relevant tests or build to verify.
- Paths are workspace-relative. Never use "../" or absolute paths.
- write_file replaces the entire file; include the full intended contents.
- When the task is done, call finish with a brief plain-language summary.
- If the user is just chatting or asking a question that needs no tools, reply in plain prose instead of JSON.

Style: plain language, direct and human, sentence case, no emojis, no em or en dashes.`

export interface AgenticOptions {
  task: string
  llm: LlmClient
  model: string
  tools: ToolSet
  approvals: ApprovalGate
  /** When true, every write pauses for explicit approval. */
  requireWriteApproval?: boolean
  /** Aborts the loop between steps. */
  signal?: AbortSignal
  /** Prior turns for chat continuity. Mutated in place: the new turn is appended. */
  history: LlmMessage[]
  /** Hard cap on tool iterations (default 16). */
  maxSteps?: number
}

export type Emit = (event: AgentEvent) => void

interface ToolCall {
  tool: string
  args: Record<string, unknown>
  thought?: string
}

/** Pull the first balanced JSON object out of a string, or null. */
function extractFirstJsonObject(text: string): string | null {
  const start = text.indexOf('{')
  if (start === -1) return null
  let depth = 0
  let inString = false
  let escape = false
  for (let i = start; i < text.length; i++) {
    const ch = text[i]
    if (escape) {
      escape = false
      continue
    }
    if (ch === '\\') {
      escape = true
      continue
    }
    if (ch === '"') inString = !inString
    if (inString) continue
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return text.slice(start, i + 1)
    }
  }
  return null
}

/** Interpret model output as a tool call, or null when it is a plain prose reply. */
export function parseToolCall(raw: string): ToolCall | null {
  const candidates: string[] = []
  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(raw)
  if (fence?.[1]) candidates.push(fence[1].trim())
  candidates.push(raw.trim())
  const braced = extractFirstJsonObject(raw)
  if (braced) candidates.push(braced)

  for (const candidate of candidates) {
    let parsed: unknown
    try {
      parsed = JSON.parse(candidate)
    } catch {
      continue
    }
    if (!parsed || typeof parsed !== 'object') continue
    const obj = parsed as Record<string, unknown>
    if (typeof obj.tool !== 'string' || !KNOWN_TOOLS.has(obj.tool)) continue
    const args =
      obj.args && typeof obj.args === 'object' ? (obj.args as Record<string, unknown>) : obj
    return {
      tool: obj.tool,
      args,
      thought: typeof obj.thought === 'string' ? obj.thought : undefined,
    }
  }
  return null
}

function truncate(text: string): string {
  if (text.length <= MAX_OBSERVATION_CHARS) return text
  return `${text.slice(0, MAX_OBSERVATION_CHARS)}\n...[truncated ${text.length - MAX_OBSERVATION_CHARS} chars]`
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

/**
 * Run the agentic loop, streaming artifacts as AgentEvents. Emits its own terminal
 * `done` event, mirroring Agent.run, so the caller only manages the running flag.
 */
export async function runAgentic(opts: AgenticOptions, emit: Emit): Promise<{ ok: boolean }> {
  const { tools, approvals, signal } = opts
  const maxSteps = opts.maxSteps ?? 16
  const messages: LlmMessage[] = [
    { role: 'system', content: AGENTIC_SYSTEM_PROMPT },
    ...opts.history,
    { role: 'user', content: opts.task },
  ]

  let ok = true
  let finalText = ''
  let usedTools = false

  for (let step = 0; step < maxSteps; step++) {
    if (signal?.aborted) {
      emit({ type: 'message', text: 'Run cancelled.' })
      ok = false
      break
    }

    let raw: string
    try {
      raw = await opts.llm.complete({ model: opts.model, messages, signal })
    } catch (err) {
      if (signal?.aborted) {
        emit({ type: 'message', text: 'Run cancelled.' })
        ok = false
        break
      }
      emit({ type: 'error', message: err instanceof Error ? err.message : String(err) })
      ok = false
      break
    }

    const call = parseToolCall(raw)
    messages.push({ role: 'assistant', content: raw })

    if (!call) {
      // Plain prose: a chat answer or a final explanation. End the turn.
      finalText = raw.trim()
      if (finalText) emit({ type: 'message', text: finalText, agent: 'orchestrator' })
      break
    }

    if (call.thought) emit({ type: 'message', text: call.thought, agent: 'orchestrator' })

    if (call.tool === 'finish') {
      finalText = str(call.args.summary)
      if (finalText) emit({ type: 'message', text: finalText, agent: 'orchestrator' })
      break
    }

    usedTools = true
    let observation: string
    try {
      observation = await runTool(call, tools, approvals, emit, opts.requireWriteApproval)
    } catch (err) {
      observation = `error: ${err instanceof Error ? err.message : String(err)}`
    }
    messages.push({ role: 'user', content: `Observation from ${call.tool}: ${truncate(observation)}` })

    if (step === maxSteps - 1) {
      emit({
        type: 'message',
        text: 'Stopping: reached the step limit for one turn. Ask me to continue if there is more to do.',
        agent: 'orchestrator',
      })
    }
  }

  // Persist a compact turn into the rolling chat history (cap to keep prompts small).
  opts.history.push({ role: 'user', content: opts.task })
  opts.history.push({
    role: 'assistant',
    content: finalText || (usedTools ? 'Completed the requested work in the workspace.' : ''),
  })
  while (opts.history.length > 20) opts.history.shift()

  emit({ type: 'done', ok })
  return { ok }
}

async function runTool(
  call: ToolCall,
  tools: ToolSet,
  approvals: ApprovalGate,
  emit: Emit,
  requireWriteApproval?: boolean,
): Promise<string> {
  switch (call.tool) {
    case 'read_file': {
      const path = str(call.args.path)
      if (!path) return 'error: read_file needs a path'
      const contents = await tools.fs.read(path)
      return contents === '' ? '(empty file)' : contents
    }

    case 'list_dir': {
      const path = str(call.args.path)
      const entries = await tools.fs.list(path)
      if (entries.length === 0) return '(empty directory)'
      return entries.map((e) => `${e.type === 'dir' ? 'dir ' : 'file'} ${e.path}`).join('\n')
    }

    case 'write_file': {
      const path = str(call.args.path)
      const contents = str(call.args.contents)
      if (!path) return 'error: write_file needs a path'

      if (requireWriteApproval) {
        const id = `write:${path}`
        emit({ type: 'approval', id, action: 'Write file', detail: path })
        const approved = await approvals.request(id)
        if (!approved) return 'write rejected by the user'
      }

      let before = ''
      try {
        before = await tools.fs.read(path)
      } catch {
        before = ''
      }
      await tools.fs.write(path, contents)
      emit({
        type: 'edit',
        path,
        diff: unifiedDiff(path, before, contents),
        before,
        agent: 'coder',
      })
      return `wrote ${contents.length} chars to ${path}`
    }

    case 'run': {
      const cmd = str(call.args.cmd)
      if (!cmd) return 'error: run needs a cmd'
      const result = await tools.terminal.exec(cmd)
      emit({
        type: 'terminal',
        agent: 'verifier',
        result: {
          cmd,
          stdout: result.stdout,
          stderr: result.stderr,
          exitCode: result.exitCode,
        },
      })
      const output = `${result.stdout}${result.stderr ? `\n${result.stderr}` : ''}`.trim()
      return `exit ${result.exitCode}\n${output || '(no output)'}`
    }

    case 'screenshot': {
      const path = str(call.args.path)
      const label = str(call.args.label) || path
      let html = ''
      try {
        html = await tools.fs.read(path)
      } catch {
        html = ''
      }
      const shot = await tools.browser.screenshot(html, label)
      emit({ type: 'screenshot', label: shot.label, image: shot.image, agent: 'browser' })
      return `captured screenshot of ${path}`
    }

    default:
      return `error: unknown tool ${call.tool}`
  }
}
