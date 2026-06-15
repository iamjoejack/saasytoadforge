'use client'

import type { AgentRole, PlanStep, TerminalResult } from '@forge/shared'
import { cn } from '@/lib/cn'

const STEP_ICON: Record<PlanStep['status'], string> = {
  pending: '○',
  running: '◐',
  done: '✓',
  failed: '✗',
  skipped: '⊘',
}

const STEP_COLOR: Record<PlanStep['status'], string> = {
  pending: 'text-zinc-500',
  running: 'text-[var(--brass)]',
  done: 'text-emerald-400',
  failed: 'text-red-400',
  skipped: 'text-zinc-600',
}

const ROLE_COLOR: Record<AgentRole, string> = {
  orchestrator: 'text-[var(--brass)] border-[var(--brass)]/40',
  coder: 'text-sky-400 border-sky-400/40',
  verifier: 'text-emerald-400 border-emerald-400/40',
  browser: 'text-violet-400 border-violet-400/40',
}

export function RoleBadge({ role }: { role?: AgentRole }) {
  if (!role) return null
  return (
    <span className={cn('rounded border px-1.5 py-0.5 text-[10px] font-medium', ROLE_COLOR[role])}>
      {role}
    </span>
  )
}

export function MessageBubble({
  role,
  text,
  agent,
}: {
  role: 'user' | 'assistant'
  text: string
  agent?: AgentRole
}) {
  const isUser = role === 'user'
  return (
    <div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[90%] rounded-lg px-3 py-2 text-[13px] leading-relaxed',
          isUser ? 'bg-[var(--brass)]/15 text-zinc-100' : 'bg-white/5 text-zinc-200',
        )}
      >
        {agent ? (
          <span className="mr-2 align-middle">
            <RoleBadge role={agent} />
          </span>
        ) : null}
        {text}
      </div>
    </div>
  )
}

export function PlanView({ steps }: { steps: PlanStep[] }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-3">
      <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-zinc-500">Plan</div>
      <ol className="space-y-1.5">
        {steps.map((step) => (
          <li key={step.id} className="flex items-center gap-2 text-[13px]">
            <span className={cn('w-4 shrink-0 text-center', STEP_COLOR[step.status])}>
              {STEP_ICON[step.status]}
            </span>
            <span className={step.status === 'done' ? 'text-zinc-300' : 'text-zinc-200'}>
              {step.title}
            </span>
            {step.role ? (
              <span className="ml-auto">
                <RoleBadge role={step.role} />
              </span>
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  )
}

export function DiffView({
  path,
  diff,
  status,
  agent,
  onAccept,
  onReject,
}: {
  path: string
  diff: string
  status: 'applied' | 'accepted' | 'rejected'
  agent?: AgentRole
  onAccept: () => void
  onReject: () => void
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-white/10 bg-black/30">
      <div className="flex items-center gap-2 border-b border-white/5 px-3 py-1.5">
        <span className="font-mono text-[11px] text-zinc-400">{path}</span>
        <span className="ml-auto">
          <RoleBadge role={agent} />
        </span>
      </div>
      <pre className="max-h-64 overflow-auto p-3 font-mono text-[12px] leading-relaxed">
        {diff.split('\n').map((line, i) => {
          const tag = line[0]
          const color =
            tag === '+'
              ? 'text-emerald-400'
              : tag === '-'
                ? 'text-red-400'
                : line.startsWith('diff ') || line.startsWith('---') || line.startsWith('+++')
                  ? 'text-zinc-600'
                  : 'text-zinc-400'
          return (
            <div key={i} className={color}>
              {line || ' '}
            </div>
          )
        })}
      </pre>
      <div className="flex items-center gap-2 border-t border-white/5 px-3 py-1.5">
        {status === 'applied' ? (
          <>
            <button
              type="button"
              onClick={onAccept}
              className="rounded bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-400 transition hover:bg-emerald-500/25"
            >
              Accept
            </button>
            <button
              type="button"
              onClick={onReject}
              className="rounded border border-zinc-600 px-2 py-0.5 text-[11px] font-medium text-zinc-300 transition hover:border-zinc-400"
            >
              Reject
            </button>
          </>
        ) : (
          <span
            className={cn(
              'text-[11px] font-medium',
              status === 'accepted' ? 'text-emerald-400' : 'text-zinc-500',
            )}
          >
            {status === 'accepted' ? 'Accepted' : 'Reverted'}
          </span>
        )}
      </div>
    </div>
  )
}

export function TerminalView({ result, agent }: { result: TerminalResult; agent?: AgentRole }) {
  const passed = result.exitCode === 0
  return (
    <div className="overflow-hidden rounded-lg border border-white/10 bg-black/40">
      <div className="flex items-center gap-2 border-b border-white/5 px-3 py-1.5">
        <span className="font-mono text-[12px] text-zinc-300">$ {result.cmd}</span>
        <RoleBadge role={agent} />
        <span
          className={cn(
            'ml-auto rounded px-1.5 py-0.5 text-[10px] font-medium',
            passed ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400',
          )}
        >
          exit {result.exitCode}
        </span>
      </div>
      <pre className="max-h-56 overflow-auto whitespace-pre-wrap p-3 font-mono text-[12px] leading-relaxed text-zinc-300">
        {result.stdout}
        {result.stderr ? <span className="text-red-400">{result.stderr}</span> : null}
      </pre>
    </div>
  )
}

export function ScreenshotView({
  label,
  image,
  agent,
}: {
  label: string
  image: string
  agent?: AgentRole
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-white/10 bg-black/30">
      <div className="flex items-center gap-2 border-b border-white/5 px-3 py-1.5">
        <span className="text-[12px] text-zinc-300">{label}</span>
        <span className="ml-auto">
          <RoleBadge role={agent} />
        </span>
      </div>
      {/* Agent-produced screenshot artifact (data URL). */}
      <img src={image} alt={label} className="w-full" />
    </div>
  )
}

export function ApprovalCard({
  action,
  detail,
  status,
  onApprove,
  onReject,
}: {
  action: string
  detail: string
  status: 'pending' | 'approved' | 'rejected'
  onApprove: () => void
  onReject: () => void
}) {
  return (
    <div className="rounded-lg border border-[var(--brass)]/30 bg-[var(--brass)]/10 p-3">
      <div className="text-[13px] text-zinc-100">
        Approval needed: <span className="font-medium">{action}</span>
      </div>
      <div className="mt-0.5 font-mono text-[12px] text-zinc-400">{detail}</div>
      {status === 'pending' ? (
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={onApprove}
            className="rounded-md bg-[var(--brass)] px-3 py-1 text-xs font-semibold text-black transition hover:brightness-110"
          >
            Approve
          </button>
          <button
            type="button"
            onClick={onReject}
            className="rounded-md border border-zinc-600 px-3 py-1 text-xs font-medium text-zinc-300 transition hover:border-zinc-400"
          >
            Reject
          </button>
        </div>
      ) : (
        <div
          className={cn(
            'mt-2 text-xs font-medium',
            status === 'approved' ? 'text-emerald-400' : 'text-zinc-500',
          )}
        >
          {status === 'approved' ? 'Approved' : 'Rejected'}
        </div>
      )}
    </div>
  )
}
