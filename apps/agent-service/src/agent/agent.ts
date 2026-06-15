import type { AgentEvent, PlanStepStatus } from '@forge/shared'
import type { Planner } from './planner'
import type { ToolSet } from './tools'
import { unifiedDiff } from './diff'

/** Lets the loop pause on actions that need explicit user approval (mission section 6.3). */
export class ApprovalGate {
  private readonly pending = new Map<string, (approved: boolean) => void>()

  request(id: string): Promise<boolean> {
    return new Promise((resolve) => this.pending.set(id, resolve))
  }

  resolve(id: string, approved: boolean): boolean {
    const resolver = this.pending.get(id)
    if (!resolver) return false
    this.pending.delete(id)
    resolver(approved)
    return true
  }

  /** Reject every pending approval (e.g. the client disconnected) so the loop unblocks. */
  rejectAll(): void {
    for (const resolver of this.pending.values()) resolver(false)
    this.pending.clear()
  }
}

/** Locks and waits for multiple-choice answers from the client. */
export class QuestionGate {
  private readonly pending = new Map<string, (selection: string[]) => void>()

  request(id: string): Promise<string[]> {
    return new Promise((resolve) => this.pending.set(id, resolve))
  }

  resolve(id: string, selection: string[]): boolean {
    const resolver = this.pending.get(id)
    if (!resolver) return false
    this.pending.delete(id)
    resolver(selection)
    return true
  }

  rejectAll(): void {
    for (const resolver of this.pending.values()) resolver([])
    this.pending.clear()
  }
}

export interface AgentRunOptions {
  task: string
  planner: Planner
  approvals: ApprovalGate
  questions: QuestionGate
  /** When true, every file write pauses for approval before being applied. */
  requireWriteApproval?: boolean
  /** Aborts the run between actions (e.g. the client disconnected or hit Stop). */
  signal?: AbortSignal
}

export type Emit = (event: AgentEvent) => void

/**
 * The agent loop: ask the planner for actions, then apply them through the scoped tool
 * surface (filesystem / terminal / browser), streaming artifacts (plan, diffs, terminal
 * output, screenshots) as events tagged with the acting subagent. Reads, edits, and test
 * runs proceed freely; side-effecting actions wait on the approval gate.
 */
export class Agent {
  constructor(private readonly tools: ToolSet) {}

  async run(opts: AgentRunOptions, emit: Emit): Promise<{ ok: boolean }> {
    const setStep = (id: string | undefined, status: PlanStepStatus) => {
      if (id) emit({ type: 'step', id, status })
    }

    // 1. Support background scheduler reminders / timers (/schedule)
    if (opts.task.startsWith('/schedule')) {
      const parts = opts.task.split(' ')
      const timePart = parts[1] ?? '5s'
      const command = parts.slice(2).join(' ') || 'echo "Timer fired"'
      
      let seconds = 5
      if (timePart.endsWith('s')) {
        seconds = parseInt(timePart.slice(0, -1)) || 5
      } else if (timePart.endsWith('m')) {
        seconds = (parseInt(timePart.slice(0, -1)) || 1) * 60
      }
      
      emit({ type: 'message', text: `Scheduled background task "${command}" to run in ${seconds} seconds.` })

      setTimeout(() => {
        emit({ type: 'message', text: `Timer fired: running "${command}" in the sandbox.` })
        void this.tools.terminal
          .exec(command)
          .then((res) => {
            emit({
              type: 'terminal',
              result: {
                cmd: command,
                stdout: res.stdout,
                stderr: res.stderr,
                exitCode: res.exitCode,
              },
            })
          })
          .catch((err) => {
            emit({ type: 'error', message: `Scheduled task failed: ${err instanceof Error ? err.message : String(err)}` })
          })
      }, seconds * 1000)
      
      emit({ type: 'done', ok: true })
      return { ok: true }
    }

    // 2. Support interactive interview question grids (/grill-me)
    if (opts.task.startsWith('/grill-me')) {
      emit({
        type: 'question',
        id: 'grill:preset',
        question: 'Which visual style preset do you prefer for this website?',
        options: ['Steampunk Industrial (Recommended)', 'Cyberpunk Glow', 'Glassmorphic Minimal', 'Retro Terminal'],
        isMultiSelect: false,
      })
      const styleAnswer = await opts.questions.request('grill:preset')
      emit({ type: 'message', text: `Selected style: **${styleAnswer.join(', ')}**` })

      emit({
        type: 'question',
        id: 'grill:extensions',
        question: 'Select the extensions you would like to pre-install in this project:',
        options: ['Supabase DB Client', 'Resend Mail SDK', 'Upstash Redis Caching', 'Vitest Testing Suite'],
        isMultiSelect: true,
      })
      const extAnswer = await opts.questions.request('grill:extensions')
      emit({ type: 'message', text: `Pre-installing: **${extAnswer.join(', ')}**` })

      emit({ type: 'message', text: 'Generating setup details. Alignment interview complete.' })
      emit({ type: 'done', ok: true })
      return { ok: true }
    }

    try {
      const actions = await opts.planner.plan(opts.task)
      let ok = true

      for (const action of actions) {
        if (opts.signal?.aborted) {
          emit({ type: 'message', text: 'Run cancelled.' })
          ok = false
          break
        }
        switch (action.kind) {
          case 'message':
            emit({ type: 'message', text: action.text, agent: action.agent })
            break

          case 'plan':
            emit({
              type: 'plan',
              steps: action.steps.map((s) => ({
                id: s.id,
                title: s.title,
                role: s.role,
                status: 'pending' as const,
              })),
            })
            break

          case 'edit': {
            if (opts.requireWriteApproval) {
              const id = `write:${action.path}`
              emit({ type: 'approval', id, action: 'Write file', detail: action.path })
              const approved = await opts.approvals.request(id)
              if (!approved) {
                setStep(action.stepId, 'skipped')
                ok = false
                break
              }
            }
            setStep(action.stepId, 'running')
            let before = ''
            try {
              before = await this.tools.fs.read(action.path)
            } catch {
              before = ''
            }
            await this.tools.fs.write(action.path, action.contents)
            emit({
              type: 'edit',
              path: action.path,
              diff: unifiedDiff(action.path, before, action.contents),
              before,
              agent: action.agent,
            })
            setStep(action.stepId, 'done')
            break
          }

          case 'run': {
            setStep(action.stepId, 'running')
            const result = await this.tools.terminal.exec(action.cmd)
            emit({
              type: 'terminal',
              agent: action.agent,
              result: {
                cmd: action.cmd,
                stdout: result.stdout,
                stderr: result.stderr,
                exitCode: result.exitCode,
              },
            })
            const passed = result.exitCode === 0
            setStep(action.stepId, passed ? 'done' : 'failed')
            if (!passed) ok = false
            break
          }

          case 'screenshot': {
            setStep(action.stepId, 'running')
            let html = ''
            try {
              html = await this.tools.fs.read(action.path)
            } catch {
              html = ''
            }
            const shot = await this.tools.browser.screenshot(html, action.label)
            emit({ type: 'screenshot', label: shot.label, image: shot.image, agent: action.agent })
            setStep(action.stepId, 'done')
            break
          }

          case 'approval': {
            const id = `action:${action.action}`
            emit({ type: 'approval', id, action: action.action, detail: action.detail })
            const approved = await opts.approvals.request(id)
            setStep(action.stepId, approved ? 'done' : 'skipped')
            if (!approved) ok = false
            break
          }
        }
      }

      emit({ type: 'done', ok })
      return { ok }
    } catch (err) {
      emit({ type: 'error', message: err instanceof Error ? err.message : String(err) })
      emit({ type: 'done', ok: false })
      return { ok: false }
    }
  }
}
