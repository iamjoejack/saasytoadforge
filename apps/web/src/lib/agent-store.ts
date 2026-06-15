import { create } from 'zustand'
import type { AgentEvent, AgentCommand, PlanStep, TerminalResult } from '@forge/shared'
import { agentUrl } from './forge-client'

export type TimelineItem =
  | { id: string; kind: 'message'; role: 'user' | 'assistant'; text: string }
  | { id: string; kind: 'plan'; steps: PlanStep[] }
  | { id: string; kind: 'edit'; path: string; diff: string }
  | { id: string; kind: 'terminal'; result: TerminalResult }
  | {
      id: string
      kind: 'approval'
      approvalId: string
      action: string
      detail: string
      status: 'pending' | 'approved' | 'rejected'
    }
  | { id: string; kind: 'error'; text: string }

let seq = 0
const nextId = () => `t${++seq}`

interface AgentStore {
  connected: boolean
  running: boolean
  requireWriteApproval: boolean
  timeline: TimelineItem[]
  socket: WebSocket | null

  connect: (workspaceId: string) => void
  disconnect: () => void
  setRequireWriteApproval: (value: boolean) => void
  runTask: (task: string) => void
  respond: (approvalId: string, approve: boolean) => void
}

function send(socket: WebSocket | null, command: AgentCommand) {
  if (socket && socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(command))
}

export const useAgent = create<AgentStore>()((set, get) => ({
  connected: false,
  running: false,
  requireWriteApproval: false,
  timeline: [],
  socket: null,

  connect: (workspaceId) => {
    get().socket?.close()
    const socket = new WebSocket(agentUrl(workspaceId))
    socket.onopen = () => set({ connected: true })
    socket.onclose = () => set({ connected: false, running: false })
    socket.onmessage = (event) => {
      if (typeof event.data !== 'string') return
      applyEvent(set, JSON.parse(event.data) as AgentEvent)
    }
    set({ socket, timeline: [] })
  },

  disconnect: () => {
    get().socket?.close()
    set({ socket: null, connected: false, running: false })
  },

  setRequireWriteApproval: (value) => set({ requireWriteApproval: value }),

  runTask: (task) => {
    const { socket, requireWriteApproval } = get()
    set((s) => ({
      running: true,
      timeline: [...s.timeline, { id: nextId(), kind: 'message', role: 'user', text: task }],
    }))
    send(socket, { type: 'task', task, requireWriteApproval })
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
}))

type SetState = (
  partial: Partial<AgentStore> | ((state: AgentStore) => Partial<AgentStore>),
) => void

function applyEvent(set: SetState, event: AgentEvent) {
  switch (event.type) {
    case 'message':
      set((s) => ({
        timeline: [
          ...s.timeline,
          { id: nextId(), kind: 'message', role: 'assistant', text: event.text },
        ],
      }))
      break
    case 'plan':
      set((s) => ({ timeline: [...s.timeline, { id: nextId(), kind: 'plan', steps: event.steps }] }))
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
        timeline: [...s.timeline, { id: nextId(), kind: 'edit', path: event.path, diff: event.diff }],
      }))
      break
    case 'terminal':
      set((s) => ({
        timeline: [...s.timeline, { id: nextId(), kind: 'terminal', result: event.result }],
      }))
      break
    case 'approval':
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
          },
        ],
      }))
      break
    case 'error':
      set((s) => ({ timeline: [...s.timeline, { id: nextId(), kind: 'error', text: event.message }] }))
      break
    case 'done':
      set({ running: false })
      break
  }
}
