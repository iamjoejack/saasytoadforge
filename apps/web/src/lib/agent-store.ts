import { create } from 'zustand'
import type { AgentEvent, AgentCommand, AgentRole, PlanStep, TerminalResult } from '@forge/shared'
import * as client from './forge-client'

export type TimelineItem =
  | { id: string; kind: 'message'; role: 'user' | 'assistant'; text: string; agent?: AgentRole; ts: number }
  | { id: string; kind: 'plan'; steps: PlanStep[]; ts: number }
  | {
      id: string
      kind: 'edit'
      path: string
      diff: string
      before: string
      status: 'applied' | 'accepted' | 'rejected'
      agent?: AgentRole
      ts: number
    }
  | { id: string; kind: 'terminal'; result: TerminalResult; agent?: AgentRole; ts: number }
  | { id: string; kind: 'screenshot'; label: string; image: string; agent?: AgentRole; ts: number }
  | {
      id: string
      kind: 'approval'
      approvalId: string
      action: string
      detail: string
      status: 'pending' | 'approved' | 'rejected'
      ts: number
    }
  | {
      id: string
      kind: 'spend_approval'
      approvalId: string
      blockUsd: number
      detail: string
      status: 'pending' | 'approved' | 'rejected'
      ts: number
    }
  | {
      id: string
      kind: 'question'
      questionId: string
      question: string
      options: string[]
      isMultiSelect: boolean
      status: 'pending' | 'answered'
      selection?: string[]
      ts: number
    }
  | { id: string; kind: 'error'; text: string; ts: number }

let seq = 0
const nextId = () => `t${++seq}`
const now = () => Date.now()

type ModelTier = 'fast' | 'frontier' | 'fusion' | 'custom'

/** Read the persisted model tier, defaulting to fusion. SSR-safe and validated. */
function readStoredTier(): ModelTier {
  if (typeof window === 'undefined') return 'fusion'
  const v = localStorage.getItem('forge:model_tier')
  return v === 'fast' || v === 'frontier' || v === 'fusion' || v === 'custom' ? v : 'fusion'
}

interface AgentStore {
  workspaceId: string | null
  connected: boolean
  running: boolean
  requireWriteApproval: boolean
  /** Model tier: fast | frontier | fusion (default) | custom */
  modelTier: 'fast' | 'frontier' | 'fusion' | 'custom'
  customModelId: string
  /** When true, the agent runs a short discovery interview before building. */
  interviewEnabled: boolean
  spendUsd: number | null
  /** Bumps whenever the agent edits a file, so the file tree can refresh. */
  fileVersion: number
  timeline: TimelineItem[]
  socket: WebSocket | null

  connect: (workspaceId: string) => void
  disconnect: () => void
  setRequireWriteApproval: (value: boolean) => void
  setModelTier: (tier: 'fast' | 'frontier' | 'fusion' | 'custom') => void
  setCustomModelId: (id: string) => void
  setInterviewEnabled: (value: boolean) => void
  runTask: (task: string) => void
  cancelRun: () => void
  respond: (approvalId: string, approve: boolean) => void
  respondSpend: (approvalId: string, blockUsd: number, approve: boolean) => void
  respondQuestion: (questionId: string, selection: string[]) => void
  acceptEdit: (itemId: string) => void
  rejectEdit: (itemId: string) => void
  clearTimeline: () => void
}

function send(socket: WebSocket | null, command: AgentCommand) {
  if (socket && socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(command))
}

export const useAgent = create<AgentStore>()((set, get) => ({
  workspaceId: null,
  connected: false,
  running: false,
  requireWriteApproval: false,
  modelTier: readStoredTier(),
  customModelId: typeof window !== 'undefined' ? (localStorage.getItem('forge:custom_model_id') || '') : '',
  interviewEnabled: typeof window !== 'undefined' ? localStorage.getItem('forge:interview') !== 'false' : true,
  spendUsd: null,
  fileVersion: 0,
  timeline: [],
  socket: null,

  connect: (workspaceId) => {
    get().socket?.close()
    set({ socket: null, workspaceId, timeline: [], spendUsd: null, connected: false })

    // The agent websocket URL needs a signed token, so connecting is async.
    void client
      .agentUrl(workspaceId)
      .then((url) => {
        if (get().workspaceId !== workspaceId) return
        const socket = new WebSocket(url)
        socket.onopen = () => {
          set({ connected: true })
          // Re-broadcast unlimited mode pref on reconnect.
          try {
            const saved = localStorage.getItem('forge:spend_prefs')
            if (saved) {
              const p = JSON.parse(saved) as { unlimitedMode?: boolean }
              if (p.unlimitedMode) {
                socket.send(JSON.stringify({ type: 'spend_topup_mode', enabled: true }))
              }
            }
          } catch { /* ignore */ }
        }
        socket.onclose = () => set({ connected: false, running: false })
        socket.onerror = () => set({ connected: false })
        socket.onmessage = (event) => {
          if (typeof event.data !== 'string') return
          let parsed: AgentEvent
          try {
            parsed = JSON.parse(event.data) as AgentEvent
          } catch {
            return
          }
          applyEvent(set, parsed)
          if (parsed.type === 'done') {
            void client
              .getSpend(workspaceId)
              .then((s) => set({ spendUsd: s.userUsd }))
              .catch(() => {})
          }
        }
        set({ socket })
      })
      .catch(() => {})

    // Rehydrate prior runs so history survives a reload.
    void client
      .getSessions(workspaceId)
      .then((sessions) => {
        for (const session of sessions) {
          for (const artifact of session.artifacts) applyEvent(set, artifact)
        }
      })
      .catch(() => {})
    void client
      .getSpend(workspaceId)
      .then((s) => set({ spendUsd: s.userUsd }))
      .catch(() => {})
  },

  disconnect: () => {
    get().socket?.close()
    set({ socket: null, connected: false, running: false })
  },

  setRequireWriteApproval: (value) => set({ requireWriteApproval: value }),
  setModelTier: (tier) => {
    try {
      localStorage.setItem('forge:model_tier', tier)
    } catch {
      // ignore storage failures (private mode, quota)
    }
    set({ modelTier: tier })
  },
  setCustomModelId: (id) => {
    try {
      localStorage.setItem('forge:custom_model_id', id)
    } catch {
      // ignore storage failures (private mode, quota)
    }
    set({ customModelId: id })
  },
  setInterviewEnabled: (value) => {
    try {
      localStorage.setItem('forge:interview', value ? 'true' : 'false')
    } catch {
      // ignore storage failures (private mode, quota)
    }
    set({ interviewEnabled: value })
  },

  runTask: (task) => {
    const { socket, requireWriteApproval, modelTier, customModelId, interviewEnabled } = get()

    // Load custom developer keys from secure local storage
    let customKeys: { anthropic?: string; google?: string } | undefined = undefined
    try {
      const saved = localStorage.getItem('forge:custom_keys')
      if (saved) {
        const parsed = JSON.parse(saved)
        customKeys = {
          anthropic: parsed.anthropic || undefined,
          google: parsed.google || undefined,
        }
      }
    } catch {
      // ignore
    }

    set((s) => ({
      running: true,
      timeline: [...s.timeline, { id: nextId(), kind: 'message', role: 'user', text: task, ts: now() }],
    }))
    send(socket, {
      type: 'task',
      task,
      requireWriteApproval,
      modelTier,
      customModelId: modelTier === 'custom' ? customModelId : undefined,
      customKeys,
      interview: interviewEnabled,
    })
  },

  cancelRun: () => {
    send(get().socket, { type: 'cancel' })
    set({ running: false })
  },

  respond: (approvalId, approve) => {
    send(get().socket, { type: approve ? 'approve' : 'reject', id: approvalId })
    set((s) => ({
      timeline: s.timeline.map((item) =>
        item.kind === 'approval' && item.approvalId === approvalId
          ? { ...item, status: approve ? 'approved' : 'rejected' }
          : item,
      ),
    }))
  },

  respondSpend: (approvalId, blockUsd, approve) => {
    if (approve) {
      send(get().socket, { type: 'spend_topup', approvalId, blockUsd })
    } else {
      send(get().socket, { type: 'reject', id: approvalId })
    }
    set((s) => ({
      timeline: s.timeline.map((item) =>
        item.kind === 'spend_approval' && item.approvalId === approvalId
          ? { ...item, status: approve ? 'approved' : 'rejected' }
          : item,
      ),
    }))
  },

  respondQuestion: (questionId, selection) => {
    send(get().socket, { type: 'answer', id: questionId, selection })
    set((s) => ({
      timeline: s.timeline.map((item) =>
        item.kind === 'question' && item.questionId === questionId
          ? { ...item, status: 'answered', selection }
          : item,
      ),
    }))
  },

  acceptEdit: (itemId) =>
    set((s) => ({
      timeline: s.timeline.map((item) =>
        item.id === itemId && item.kind === 'edit' ? { ...item, status: 'accepted' } : item,
      ),
    })),

  rejectEdit: (itemId) => {
    const { workspaceId, timeline } = get()
    const item = timeline.find((i) => i.id === itemId)
    if (!workspaceId || item?.kind !== 'edit') return
    void client.writeFile(workspaceId, item.path, item.before)
    set((s) => ({
      timeline: s.timeline.map((i) =>
        i.id === itemId && i.kind === 'edit' ? { ...i, status: 'rejected' } : i,
      ),
    }))
  },

  clearTimeline: () => set({ timeline: [] }),
}))

type SetState = (
  partial: Partial<AgentStore> | ((state: AgentStore) => Partial<AgentStore>),
) => void

// Detect spend-approval events: approval events whose id starts with "spend_"
function isSpendApproval(event: { type: 'approval'; id: string; action: string; detail: string }) {
  return event.id.startsWith('spend_')
}

function applyEvent(set: SetState, event: AgentEvent) {
  switch (event.type) {
    case 'message':
      set((s) => ({
        timeline: [
          ...s.timeline,
          { id: nextId(), kind: 'message', role: 'assistant', text: event.text, agent: event.agent, ts: now() },
        ],
      }))
      break
    case 'plan':
      set((s) => ({ timeline: [...s.timeline, { id: nextId(), kind: 'plan', steps: event.steps, ts: now() }] }))
      break
    case 'step':
      set((s) => ({
        timeline: s.timeline.map((item) =>
          item.kind === 'plan'
            ? {
                ...item,
                steps: item.steps.map((step) =>
                  step.id === event.id ? { ...step, status: event.status } : step,
                ),
              }
            : item,
        ),
      }))
      break
    case 'edit':
      set((s) => ({
        fileVersion: s.fileVersion + 1,
        timeline: [
          ...s.timeline,
          {
            id: nextId(),
            kind: 'edit',
            path: event.path,
            diff: event.diff,
            before: event.before ?? '',
            status: 'applied',
            agent: event.agent,
            ts: now(),
          },
        ],
      }))
      break
    case 'terminal':
      set((s) => ({
        timeline: [
          ...s.timeline,
          { id: nextId(), kind: 'terminal', result: event.result, agent: event.agent, ts: now() },
        ],
      }))
      break
    case 'screenshot':
      set((s) => ({
        timeline: [
          ...s.timeline,
          { id: nextId(), kind: 'screenshot', label: event.label, image: event.image, agent: event.agent, ts: now() },
        ],
      }))
      break
    case 'approval':
      if (isSpendApproval(event)) {
        // Parse block size from the detail string — format: "...Approve a $X.XX credit extension?"
        const match = event.detail.match(/\$(\d+(?:\.\d+)?)/)
        const blockUsd = match?.[1] != null ? parseFloat(match[1]) : 5
        set((s) => ({
          timeline: [
            ...s.timeline,
            {
              id: nextId(),
              kind: 'spend_approval',
              approvalId: event.id,
              blockUsd,
              detail: event.detail,
              status: 'pending',
              ts: now(),
            },
          ],
        }))
      } else {
        set((s) => ({
          timeline: [
            ...s.timeline,
            {
              id: nextId(),
              kind: 'approval',
              approvalId: event.id,
              action: event.action,
              detail: event.detail,
              status: 'pending',
              ts: now(),
            },
          ],
        }))
      }
      break
    case 'question':
      set((s) => ({
        timeline: [
          ...s.timeline,
          {
            id: nextId(),
            kind: 'question',
            questionId: event.id,
            question: event.question,
            options: event.options,
            isMultiSelect: event.isMultiSelect,
            status: 'pending',
            ts: now(),
          },
        ],
      }))
      break
    case 'error':
      set((s) => ({ timeline: [...s.timeline, { id: nextId(), kind: 'error', text: event.message, ts: now() }] }))
      if (typeof window !== 'undefined' && localStorage.getItem('forge:notifications') === 'true') {
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('Forge Agent Task Error', {
            body: event.message,
          })
        }
      }
      break
    case 'done':
      set({ running: false })
      if (typeof window !== 'undefined' && localStorage.getItem('forge:notifications') === 'true') {
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('Forge Agent Task Complete', {
            body: event.ok ? 'The task has completed successfully!' : 'The task has completed, but encountered issues.',
          })
        }
      }
      break
  }
}
