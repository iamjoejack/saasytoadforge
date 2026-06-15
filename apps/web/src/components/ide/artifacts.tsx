'use client'

import type { PlanStep, TerminalResult } from '@forge/shared'
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

export function MessageBubble({ role, text }: { role: 'user' | 'assistant'; text: string }) {
  const isUser = role === 'user'
  return (
    <div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[90%] rounded-lg px-3 py-2 text-[13px] leading-relaxed',
          isUser ? 'bg-[var(--brass)]/15 text-zinc-100' : 'bg-white/5 text-zinc-200',
        )}
      >
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
          <li key={step.id} className="flex items-start gap-2 text-[13px]">
            <span className={cn('w-4 shrink-0 text-center', STEP_COLOR[step.status])}>
              {STEP_ICON[step.status]}
            </span>
            <span className={step.status === 'done' ? 'text-zinc-300' : 'text-zinc-200'}>
              {step.title}
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}

export function DiffView({ path, diff }: { path: string; diff: string }) {
  return (
    <div className="overflow-hidden rounded-lg border border-white/10 bg-black/30">
      <div className="border-b border-white/5 px-3 py-1.5 font-mono text-[11px] text-zinc-400">
        {path}
      </div>
      <pre className="overflow-x-auto p-3 font-mono text-[12px] leading-relaxed">
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
    </div>
  )
}

export function TerminalView({ result }: { result: TerminalResult }) {
  const passed = result.exitCode === 0
  return (
    <div className="overflow-hidden rounded-lg border border-white/10 bg-black/40">
      <div className="flex items-center gap-2 border-b border-white/5 px-3 py-1.5">
        <span className="font-mono text-[12px] text-zinc-300">$ {result.cmd}</span>
        <span
          className={cn(
            'ml-auto rounded px-1.5 py-0.5 text-[10px] font-medium',
            passed ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400',
          )}
        >
          exit {result.exitCode}
        </span>
      </div>
      <pre className="overflow-x-auto whitespace-pre-wrap p-3 font-mono text-[12px] leading-relaxed text-zinc-300">
        {result.stdout}
        {result.stderr ? <span className="text-red-400">{result.stderr}</span> : null}
      </pre>
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
