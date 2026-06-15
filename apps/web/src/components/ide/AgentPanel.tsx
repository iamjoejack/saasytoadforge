'use client'

import { useEffect, useRef, useState } from 'react'
import { useAgent } from '@/lib/agent-store'
import { Toad } from '@/components/Toad'
import { cn } from '@/lib/cn'
import {
  MessageBubble,
  PlanView,
  DiffView,
  TerminalView,
  ScreenshotView,
  ApprovalCard,
} from './artifacts'

export function AgentPanel({ workspaceId }: { workspaceId: string }) {
  const connect = useAgent((s) => s.connect)
  const disconnect = useAgent((s) => s.disconnect)
  const connected = useAgent((s) => s.connected)
  const running = useAgent((s) => s.running)
  const timeline = useAgent((s) => s.timeline)
  const requireWriteApproval = useAgent((s) => s.requireWriteApproval)
  const setRequireWriteApproval = useAgent((s) => s.setRequireWriteApproval)
  const runTask = useAgent((s) => s.runTask)
  const respond = useAgent((s) => s.respond)
  const acceptEdit = useAgent((s) => s.acceptEdit)
  const rejectEdit = useAgent((s) => s.rejectEdit)

  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    connect(workspaceId)
    return () => disconnect()
  }, [workspaceId, connect, disconnect])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [timeline])

  function submit() {
    const task = input.trim()
    if (!task || running) return
    runTask(task)
    setInput('')
  }

  return (
    <div className="flex h-full flex-col bg-[#0c0c0e]">
      <div className="flex items-center gap-2 border-b border-white/5 px-3 py-2">
        <Toad className="h-5 w-5" />
        <span className="text-[13px] font-medium text-zinc-200">Ronald</span>
        <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] text-zinc-500">
          <span
            className={cn(
              'h-1.5 w-1.5 rounded-full',
              running ? 'animate-pulse bg-[var(--brass)]' : connected ? 'bg-emerald-500' : 'bg-zinc-600',
            )}
          />
          {running ? 'working' : connected ? 'ready' : 'offline'}
        </span>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-auto p-3">
        {timeline.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-4 text-center">
            <Toad className="h-14 w-14 opacity-90" />
            <p className="mt-4 text-sm text-zinc-300">Describe a task and Ronald takes it from here.</p>
            <p className="mt-2 text-xs leading-relaxed text-zinc-500">
              Try: &ldquo;add an endpoint that returns the current time and a test for it.&rdquo;
            </p>
          </div>
        ) : (
          timeline.map((item) => {
            switch (item.kind) {
              case 'message':
                return (
                  <MessageBubble key={item.id} role={item.role} text={item.text} agent={item.agent} />
                )
              case 'plan':
                return <PlanView key={item.id} steps={item.steps} />
              case 'edit':
                return (
                  <DiffView
                    key={item.id}
                    path={item.path}
                    diff={item.diff}
                    status={item.status}
                    agent={item.agent}
                    onAccept={() => acceptEdit(item.id)}
                    onReject={() => rejectEdit(item.id)}
                  />
                )
              case 'terminal':
                return <TerminalView key={item.id} result={item.result} agent={item.agent} />
              case 'screenshot':
                return (
                  <ScreenshotView
                    key={item.id}
                    label={item.label}
                    image={item.image}
                    agent={item.agent}
                  />
                )
              case 'approval':
                return (
                  <ApprovalCard
                    key={item.id}
                    action={item.action}
                    detail={item.detail}
                    status={item.status}
                    onApprove={() => respond(item.approvalId, true)}
                    onReject={() => respond(item.approvalId, false)}
                  />
                )
              case 'error':
                return (
                  <div key={item.id} className="rounded-lg bg-red-500/10 px-3 py-2 text-[13px] text-red-400">
                    {item.text}
                  </div>
                )
            }
          })
        )}
      </div>

      <div className="border-t border-white/5 p-3">
        <label className="mb-2 flex items-center gap-2 text-[11px] text-zinc-500">
          <input
            type="checkbox"
            checked={requireWriteApproval}
            onChange={(e) => setRequireWriteApproval(e.target.checked)}
            className="accent-[var(--brass)]"
          />
          require approval before each file write
        </label>
        <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/30 px-3 py-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                submit()
              }
            }}
            placeholder="Describe a task"
            className="w-full bg-transparent text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none"
          />
          <button
            type="button"
            onClick={submit}
            disabled={running || input.trim().length === 0}
            className="rounded-md bg-[var(--brass)] px-3 py-1 text-xs font-semibold text-black transition hover:brightness-110 disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}
