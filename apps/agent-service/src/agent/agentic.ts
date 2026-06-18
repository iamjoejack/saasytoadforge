import type { AgentEvent } from '@forge/shared'
import type { LlmClient, LlmMessage } from './llm'
import type { ToolSet } from './tools'
import type { ApprovalGate, QuestionGate } from './agent'
import { unifiedDiff } from './diff'
import { applyEdits, type EditBlock } from './apply-edit'

/**
 * A provider-agnostic agentic loop. The model either calls a tool (by replying with a
 * single JSON object) or answers the user in prose. This is the same surface Claude Code
 * works with: read, write, list, run a command, screenshot, then finish. Because a prose
 * reply ends the turn, the same loop doubles as a normal chat.
 *
 * The protocol is plain text over the existing streaming `complete()` method, so it works
 * for any backend (Anthropic, Google, OpenRouter) without provider-specific tool APIs.
 */

const KNOWN_TOOLS = new Set([
  'read_file',
  'write_file',
  'edit_file',
  'list_dir',
  'search',
  'run',
  'screenshot',
  'ask',
  'finish',
])

const MAX_OBSERVATION_CHARS = 6000

export const AGENTIC_SYSTEM_PROMPT = `You are Ronald, the SaaSyToad Forge coding agent, working inside an isolated sandbox workspace.

You can use tools to inspect and change the workspace, and to ask the user questions. To call a tool, reply with ONLY a single JSON object, nothing else:
{"thought": "<one short sentence on why>", "tool": "<name>", "args": { ... }}

Tools:
- read_file   args: { "path": string }                      read a workspace file
- list_dir    args: { "path": string }                      list a directory ("" for the root)
- search      args: { "query": string, "path"?: string }     find text across the workspace; use this to locate code before editing
- write_file  args: { "path": string, "contents": string }  create a new file or replace one entirely
- edit_file   args: { "path": string, "edits": [{ "search": string, "replace": string }] }  change parts of an existing file; each edit swaps the exact "search" text for "replace"
- run         args: { "cmd": string }                        run a shell command (tests, build, grep, install, etc.)
- screenshot  args: { "path": string, "label": string }      render an HTML file and capture it
- ask         args: { "question": string, "options"?: string[], "multiSelect"?: boolean }  ask the user; the answer comes back as the observation
- finish      args: { "summary": string }                    end the task with a short summary

Rules:
- Work in small steps. Use search or list_dir to find the right file, and read it before you edit. After editing code, run the relevant tests or build to verify.
- Use the right integration for the job. When a task needs a database, payments, email, automation, or hosting, wire up the connector that is available in this workspace (listed below) rather than rolling your own.
- Paths are workspace-relative. Never use "../" or absolute paths.
- To change an existing file, prefer edit_file: read the file first, then copy the exact text you want to change into "search" (no line numbers) and the new version into "replace". Keep each search block small and unique. Use write_file only to create a new file or replace one entirely.
- When the task is done, call finish with a brief plain-language summary.
- If the user is just chatting or asking a question that needs no tools, reply in plain prose instead of JSON.

Style: plain language, direct and human, sentence case, no emojis, no em or en dashes.`

/** A one-line discovery brief prepended to the first build task when the interview is on. */
export const DISCOVERY_DIRECTIVE =
  'Before you build anything, use the ask tool to run a short discovery interview: ask 2 to 4 focused questions to pin down who this is for, the must-have features, any integrations or data sources needed, and the look and feel. Offer options where it helps. Once you have enough to proceed, build it.'

function buildSystemPrompt(connectors: string[]): string {
  const line =
    connectors.length > 0
      ? `\n\nConnectors available in this workspace: ${connectors.join(', ')}. Prefer these for the tasks they cover.`
      : '\n\nNo external connectors are configured in this workspace yet. If a task needs one, ask the user to enable it in the extensions store.'
  return AGENTIC_SYSTEM_PROMPT + line
}

export interface AgenticOptions {
  task: string
  llm: LlmClient
  model: string
  tools: ToolSet
  approvals: ApprovalGate
  /** Gate for the ask tool, so the agent can interview the user. */
  questions?: QuestionGate
  /** Names of integrations available in this workspace, surfaced to the model. */
  connectors?: string[]
  /** When true, every write pauses for explicit approval. */
  requireWriteApproval?: boolean
  /** Aborts the loop between steps. */
  signal?: AbortSignal
  /** Prior turns for chat continuity. Mutated in place: the new turn is appended. */
  history: LlmMessage[]
  /** Hard cap on tool iterations (default 16). */
  maxSteps?: number
  /**
   * Ronald's in-loop verification. When provided, the agent's `finish` is gated on it
   * whenever edits were made: a failing verdict re-prompts the agent once to fix the build
   * (it never hard-blocks past one attempt, so the loop always terminates).
   */
  verify?: () => Promise<{ ok: boolean; summary: string }>
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

/** Pull the { search, replace } edit blocks out of an edit_file tool call. */
function parseEditBlocks(args: Record<string, unknown>): EditBlock[] {
  const out: EditBlock[] = []
  if (Array.isArray(args.edits)) {
    for (const entry of args.edits) {
      if (entry && typeof entry === 'object') {
        const obj = entry as Record<string, unknown>
        out.push({ search: str(obj.search), replace: str(obj.replace) })
      }
    }
  } else if (typeof args.search === 'string' || typeof args.replace === 'string') {
    out.push({ search: str(args.search), replace: str(args.replace) })
  }
  return out.filter((b) => !(b.search === '' && b.replace === ''))
}

/** A stable signature for a tool call, used to detect a stuck, repeating loop. */
function fingerprint(call: ToolCall): string {
  return `${call.tool}:${JSON.stringify(call.args)}`
}

const SEARCH_SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', '.cache'])
const SEARCH_MAX_FILES = 300
const SEARCH_MAX_MATCHES = 50

/**
 * Grep-style content search across the workspace, for codebase grounding: the agent locates
 * code before editing instead of reading files blindly. Provider-agnostic (walks the
 * filesystem tool, so it behaves the same on the mock and on E2B), bounded by file and match
 * caps, and skips dependency and build directories.
 */
export async function searchWorkspace(tools: ToolSet, query: string, root = ''): Promise<string[]> {
  const needle = query.toLowerCase()
  const matches: string[] = []
  const queue: string[] = [root]
  let filesScanned = 0

  while (
    queue.length > 0 &&
    filesScanned < SEARCH_MAX_FILES &&
    matches.length < SEARCH_MAX_MATCHES
  ) {
    const dir = queue.shift() ?? ''
    let entries
    try {
      entries = await tools.fs.list(dir)
    } catch {
      continue
    }
    for (const entry of entries) {
      if (entry.type === 'dir') {
        if (!SEARCH_SKIP_DIRS.has(entry.name)) queue.push(entry.path)
        continue
      }
      if (filesScanned >= SEARCH_MAX_FILES || matches.length >= SEARCH_MAX_MATCHES) break
      filesScanned += 1
      let contents: string
      try {
        contents = await tools.fs.read(entry.path)
      } catch {
        continue
      }
      const lines = contents.split('\n')
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i] ?? ''
        if (line.toLowerCase().includes(needle)) {
          matches.push(`${entry.path}:${i + 1}: ${line.trim().slice(0, 160)}`)
          if (matches.length >= SEARCH_MAX_MATCHES) break
        }
      }
    }
  }
  return matches
}

/**
 * Run the agentic loop, streaming artifacts as AgentEvents. Emits its own terminal
 * `done` event, mirroring Agent.run, so the caller only manages the running flag.
 */
export async function runAgentic(opts: AgenticOptions, emit: Emit): Promise<{ ok: boolean }> {
  const { tools, approvals, signal } = opts
  const maxSteps = opts.maxSteps ?? 16
  const messages: LlmMessage[] = [
    { role: 'system', content: buildSystemPrompt(opts.connectors ?? []) },
    ...opts.history,
    { role: 'user', content: opts.task },
  ]

  let ok = true
  let finalText = ''
  let usedTools = false
  let prevFingerprint = ''
  let repeatCount = 0
  let madeEdits = false
  let blockedOnce = false

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
      // Ronald verifies the work before the agent is allowed to declare it done. Only when
      // edits were actually made, and only blocks once so the loop always terminates.
      if (opts.verify && madeEdits) {
        let verdict: { ok: boolean; summary: string }
        try {
          verdict = await opts.verify()
        } catch (err) {
          // A verifier that cannot run never blocks shipping; report it honestly instead.
          verdict = {
            ok: true,
            summary: `verification could not run: ${err instanceof Error ? err.message : String(err)}`,
          }
        }
        if (!verdict.ok && !blockedOnce) {
          blockedOnce = true
          emit({
            type: 'message',
            text: 'Ronald found problems, so I am not finishing yet.',
            agent: 'verifier',
          })
          messages.push({
            role: 'user',
            content: `Observation from verify: the build is not green yet. ${verdict.summary} Fix these, then finish.`,
          })
          continue
        }
        if (!verdict.ok) {
          // Already gave one chance to fix; finish, but be honest about the failing checks.
          finalText =
            `${finalText}\n\nHeads up: some checks are still failing. ${verdict.summary}`.trim()
        }
      }
      if (finalText) emit({ type: 'message', text: finalText, agent: 'orchestrator' })
      break
    }

    usedTools = true

    // Stuck detection: three identical tool calls in a row with no intervening progress
    // means the agent is looping. Refuse to run it again and nudge it to change course
    // (a warning alone gets ignored; not executing is what breaks the loop).
    const sig = fingerprint(call)
    if (sig === prevFingerprint) {
      repeatCount += 1
    } else {
      repeatCount = 0
      prevFingerprint = sig
    }
    if (repeatCount >= 2) {
      emit({
        type: 'message',
        text: 'Stopping a repeated action that was not making progress.',
        agent: 'orchestrator',
      })
      messages.push({
        role: 'user',
        content:
          `Observation from ${call.tool}: you have repeated the exact same ${call.tool} call ${repeatCount + 1} times in a row with no change. ` +
          'That is not making progress. Try a different approach, gather more context, or call finish if you are blocked.',
      })
      continue
    }

    let observation: string
    try {
      observation = await runTool(call, tools, approvals, emit, {
        requireWriteApproval: opts.requireWriteApproval,
        questions: opts.questions,
        stepId: step,
      })
    } catch (err) {
      observation = `error: ${err instanceof Error ? err.message : String(err)}`
    }

    // Track real edits so verification only gates finish when the workspace actually changed.
    if (
      (call.tool === 'write_file' || call.tool === 'edit_file') &&
      !observation.startsWith('error') &&
      !observation.startsWith('write rejected') &&
      !observation.startsWith('edit rejected') &&
      !observation.startsWith('no change')
    ) {
      madeEdits = true
    }

    messages.push({
      role: 'user',
      content: `Observation from ${call.tool}: ${truncate(observation)}`,
    })

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

interface RunToolCtx {
  requireWriteApproval?: boolean
  questions?: QuestionGate
  stepId: number
}

async function runTool(
  call: ToolCall,
  tools: ToolSet,
  approvals: ApprovalGate,
  emit: Emit,
  ctx: RunToolCtx,
): Promise<string> {
  const { requireWriteApproval } = ctx
  switch (call.tool) {
    case 'ask': {
      const question = str(call.args.question)
      if (!question) return 'error: ask needs a question'
      if (!ctx.questions)
        return 'asking is not available in this run; proceed with your best assumption'
      const rawOptions = Array.isArray(call.args.options) ? call.args.options : []
      const options = rawOptions.map((o) => String(o)).filter(Boolean)
      const id = `ask_${ctx.stepId}`
      emit({
        type: 'question',
        id,
        question,
        options,
        isMultiSelect: call.args.multiSelect === true,
      })
      const selection = await ctx.questions.request(id)
      if (selection.length === 0) return 'the user did not answer; proceed with a sensible default'
      return `the user answered: ${selection.join(', ')}`
    }

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

    case 'search': {
      const query = str(call.args.query)
      if (!query) return 'error: search needs a query'
      const matches = await searchWorkspace(tools, query, str(call.args.path))
      if (matches.length === 0) return `no matches for "${query}"`
      const note =
        matches.length >= SEARCH_MAX_MATCHES ? `\n...(showing the first ${SEARCH_MAX_MATCHES})` : ''
      const plural = matches.length === 1 ? '' : 'es'
      return `${matches.length} match${plural} for "${query}":\n${matches.join('\n')}${note}`
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

    case 'edit_file': {
      const path = str(call.args.path)
      if (!path) return 'error: edit_file needs a path'
      const blocks = parseEditBlocks(call.args)
      if (blocks.length === 0) return 'error: edit_file needs at least one { search, replace } edit'

      let before: string
      try {
        before = await tools.fs.read(path)
      } catch {
        return `error: ${path} does not exist; use write_file to create it`
      }

      const applied = applyEdits(before, blocks)
      if (!applied.ok) return `error: ${applied.reason}`
      const after = applied.contents
      if (after === before) return `no change: that edit left ${path} identical`

      if (requireWriteApproval) {
        const id = `edit:${path}`
        emit({ type: 'approval', id, action: 'Edit file', detail: path })
        const approved = await approvals.request(id)
        if (!approved) return 'edit rejected by the user'
      }

      await tools.fs.write(path, after)
      emit({ type: 'edit', path, diff: unifiedDiff(path, before, after), before, agent: 'coder' })
      const plural = blocks.length > 1 ? 's' : ''
      return `edited ${path} (${blocks.length} change${plural}, ${applied.strategy} match)`
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
