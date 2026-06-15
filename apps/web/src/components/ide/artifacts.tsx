'use client'

import { useState, useCallback } from 'react'
import type { AgentRole, PlanStep, TerminalResult } from '@forge/shared'
import { Toad } from '@/components/Toad'
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
  running: 'text-[var(--brass)] animate-pulse',
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
    <span className={cn('rounded border px-1.5 py-0.5 text-[10px] font-medium flex items-center gap-1', ROLE_COLOR[role])}>
      {role}
    </span>
  )
}

/** Format a ms timestamp to a short relative string. */
function relativeTime(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000)
  if (diff < 5) return 'just now'
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  const d = new Date(ts)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function CopyCodeBlockButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const copy = useCallback(() => {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    })
  }, [text])

  return (
    <button
      type="button"
      onClick={copy}
      className="text-zinc-500 hover:text-zinc-300 transition text-[9px] font-semibold flex items-center gap-1 cursor-pointer"
    >
      {copied ? '✓ Copied' : 'Copy'}
    </button>
  )
}

function parseInlineMarkdown(text: string): React.ReactNode[] {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\(file:\/\/[^\s)]+\))/g)
  return parts.map((part, pi) => {
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={pi} className="font-mono text-[11px] bg-black/50 px-1 py-0.5 rounded text-emerald-400 border border-white/5">
          {part.slice(1, -1)}
        </code>
      )
    }
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={pi} className="font-bold text-white">
          {part.slice(2, -2)}
        </strong>
      )
    }
    const linkMatch = part.match(/^\[([^\]]+)\]\((file:\/\/[^\s)]+)\)$/)
    if (linkMatch) {
      return (
        <a
          key={pi}
          href={linkMatch[2]}
          className="text-[var(--brass)] underline hover:brightness-110 transition animate-fade-in"
          target="_blank"
          rel="noreferrer"
        >
          {linkMatch[1]}
        </a>
      )
    }
    return part
  })
}

/** Lightweight visual markdown renderer — no external dependencies. */
function renderMarkdown(text: string): React.ReactNode {
  const lines = text.split('\n')
  const finalElements: React.ReactNode[] = []
  
  let inCodeBlock = false
  let codeBlockLines: string[] = []
  let codeBlockLang = ''
  let currentParagraphLines: string[] = []
  let currentListItems: string[] = []

  const flushParagraph = (key: string | number) => {
    if (currentParagraphLines.length > 0) {
      const content = currentParagraphLines.join('\n')
      finalElements.push(
        <p key={`p-${key}`} className="mb-2 last:mb-0 leading-relaxed text-[13px] text-zinc-200">
          {parseInlineMarkdown(content)}
        </p>
      )
      currentParagraphLines = []
    }
  }

  const flushList = (key: string | number) => {
    if (currentListItems.length > 0) {
      finalElements.push(
        <ul key={`list-${key}`} className="list-disc pl-5 mb-2.5 space-y-1 text-[13px] text-zinc-200">
          {currentListItems.map((item, idx) => (
            <li key={idx}>{parseInlineMarkdown(item)}</li>
          ))}
        </ul>
      )
      currentListItems = []
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? ''

    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        const codeText = codeBlockLines.join('\n')
        const lang = codeBlockLang || 'code'
        finalElements.push(
          <div key={`code-${i}`} className="my-2.5 rounded-lg border border-white/10 bg-black/60 overflow-hidden font-mono text-[11px]">
            <div className="flex items-center justify-between bg-black/30 px-3 py-1.5 border-b border-white/5 text-[10px] text-zinc-500 font-sans">
              <span>{lang.toUpperCase()}</span>
              <CopyCodeBlockButton text={codeText} />
            </div>
            <pre className="p-3 text-emerald-400 overflow-auto whitespace-pre leading-relaxed select-text">
              <code>{codeText}</code>
            </pre>
          </div>
        )
        codeBlockLines = []
        inCodeBlock = false
      } else {
        flushParagraph(i)
        flushList(i)
        inCodeBlock = true
        codeBlockLang = line.replace(/```/g, '').trim()
      }
      continue
    }

    if (inCodeBlock) {
      codeBlockLines.push(line)
      continue
    }

    const listMatch = line.match(/^[\s]*[-*+]\s+(.*)$/)
    if (listMatch) {
      flushParagraph(i)
      currentListItems.push(listMatch[1] ?? '')
      continue
    }

    if (line.trim() === '') {
      flushParagraph(i)
      flushList(i)
    } else {
      flushList(i)
      currentParagraphLines.push(line)
    }
  }

  flushParagraph('end')
  flushList('end')

  return <div className="space-y-0.5">{finalElements}</div>
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const copy = useCallback(() => {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    })
  }, [text])

  return (
    <button
      type="button"
      onClick={copy}
      title="Copy message"
      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded text-zinc-600 hover:text-zinc-300 cursor-pointer"
    >
      {copied ? (
        <svg className="h-3.5 w-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      )}
    </button>
  )
}

export function ThinkingBubble() {
  return (
    <div className="flex justify-start">
      <div className="flex items-center gap-2 rounded-2xl rounded-tl-sm bg-white/5 px-4 py-3">
        <div className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--brass)]/70 animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--brass)]/70 animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--brass)]/70 animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
        <span className="text-[11px] text-zinc-500 italic">thinking...</span>
      </div>
    </div>
  )
}

export function MessageBubble({
  role,
  text,
  agent,
  ts,
  isStreaming,
}: {
  role: 'user' | 'assistant'
  text: string
  agent?: AgentRole
  ts?: number
  isStreaming?: boolean
}) {
  const isUser = role === 'user'
  return (
    <div className={cn('group flex gap-2', isUser ? 'justify-end' : 'justify-start')}>
      {!isUser && (
        <div className="mt-0.5 h-6 w-6 shrink-0 rounded-full bg-[var(--brass)]/10 border border-[var(--brass)]/25 flex items-center justify-center text-[11px]">
          <Toad className="h-3.5 w-3.5" />
        </div>
      )}
      <div className="flex flex-col gap-0.5 max-w-[88%]">
        {agent && !isUser && (
          <div className="flex items-center gap-1.5 mb-0.5">
            <RoleBadge role={agent} />
          </div>
        )}
        <div
          className={cn(
            'relative rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed',
            isUser
              ? 'rounded-tr-sm bg-[var(--brass)]/20 text-zinc-100 border border-[var(--brass)]/20'
              : 'rounded-tl-sm bg-white/[0.06] text-zinc-200 border border-white/5',
          )}
        >
          <div className={cn('flex items-start gap-2', isUser ? 'flex-row-reverse' : 'flex-row')}>
            <div className="flex-1 min-w-0">
              {isUser ? (
                text
              ) : (
                <div className="relative">
                  {renderMarkdown(text)}
                  {isStreaming && (
                    <span className="inline-block w-1.5 h-3.5 bg-[var(--brass)] animate-pulse ml-0.5 align-middle" aria-hidden />
                  )}
                </div>
              )}
            </div>
            {!isUser && <CopyButton text={text} />}
          </div>
        </div>
        {ts && (
          <span className={cn('text-[9px] text-zinc-650 px-1', isUser ? 'text-right' : 'text-left')}>
            {relativeTime(ts)}
          </span>
        )}
      </div>
      {isUser && (
        <div className="mt-0.5 h-6 w-6 shrink-0 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-[11px]" />
      )}
    </div>
  )
}

export function PlanView({ steps }: { steps: PlanStep[] }) {
  const done = steps.filter((s) => s.status === 'done').length
  const pct = steps.length > 0 ? Math.round((done / steps.length) * 100) : 0
  return (
    <div className="rounded-xl border border-white/10 bg-black/25 overflow-hidden">
      <div className="flex items-center justify-between border-b border-white/5 px-3 py-2">
        <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Agent Plan</div>
        <div className="flex items-center gap-2">
          <div className="h-1 w-20 rounded-full bg-zinc-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-[var(--brass)] transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-[10px] text-zinc-500 tabular-nums">{done}/{steps.length}</span>
        </div>
      </div>
      <ol className="p-2.5 space-y-1">
        {steps.map((step) => (
          <li key={step.id} className="flex items-center gap-2.5 text-[13px] rounded px-2 py-1 hover:bg-white/[0.02]">
            <span className={cn('w-4 shrink-0 text-center text-[13px]', STEP_COLOR[step.status])}>
              {STEP_ICON[step.status]}
            </span>
            <span className={step.status === 'done' ? 'text-zinc-400 line-through' : 'text-zinc-200'}>
              {step.title}
            </span>
            {step.role ? (
              <span className="ml-auto shrink-0">
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
  const [expanded, setExpanded] = useState(false)
  const lines = diff.split('\n')
  const preview = expanded ? lines : lines.slice(0, 10)
  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-black/30">
      <div className="flex items-center gap-2 border-b border-white/5 px-3 py-2 bg-black/20">
        <span className="font-mono text-[11px] text-zinc-300 truncate">{path}</span>
        <span className="ml-auto shrink-0">
          <RoleBadge role={agent} />
        </span>
      </div>
      <pre className="p-3 font-mono text-[11px] leading-relaxed overflow-auto" style={{ maxHeight: expanded ? '360px' : '140px' }}>
        {preview.map((line, i) => {
          const tag = line[0]
          const color =
            tag === '+'
              ? 'text-emerald-400'
              : tag === '-'
                ? 'text-red-400'
                : line.startsWith('diff ') || line.startsWith('---') || line.startsWith('+++')
                  ? 'text-zinc-600'
                  : 'text-zinc-450'
          return (
            <div key={i} className={color}>
              {line || ' '}
            </div>
          )
        })}
        {!expanded && lines.length > 10 && (
          <div className="text-zinc-600 italic pt-1">…{lines.length - 10} more lines</div>
        )}
      </pre>
      <div className="flex items-center gap-2 border-t border-white/5 px-3 py-2 bg-black/10">
        {lines.length > 10 && (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="text-[10px] text-zinc-500 hover:text-zinc-300 transition cursor-pointer underline"
          >
            {expanded ? 'Collapse' : 'Show full diff'}
          </button>
        )}
        <div className="ml-auto flex items-center gap-2">
          {status === 'applied' ? (
            <>
              <button
                type="button"
                onClick={onAccept}
                className="rounded-lg bg-emerald-500/15 px-3 py-1 text-[11px] font-semibold text-emerald-400 transition hover:bg-emerald-500/25 cursor-pointer border border-emerald-500/20"
              >
                ✓ Accept
              </button>
              <button
                type="button"
                onClick={onReject}
                className="rounded-lg border border-zinc-700 px-3 py-1 text-[11px] font-medium text-zinc-400 transition hover:border-zinc-500 cursor-pointer"
              >
                ✕ Revert
              </button>
            </>
          ) : (
            <span
              className={cn(
                'text-[11px] font-semibold',
                status === 'accepted' ? 'text-emerald-400' : 'text-zinc-600',
              )}
            >
              {status === 'accepted' ? '✓ Accepted' : '↩ Reverted'}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

export function TerminalView({ result, agent }: { result: TerminalResult; agent?: AgentRole }) {
  const passed = result.exitCode === 0
  const [expanded, setExpanded] = useState(false)
  const output = (result.stdout + (result.stderr ? `\n${result.stderr}` : '')).trim()
  const lines = output.split('\n')
  const previewLines = expanded ? lines : lines.slice(-12)
  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-black/40">
      <div className="flex items-center gap-2 border-b border-white/5 px-3 py-2 bg-black/20">
        <span className="text-zinc-500 text-[12px]">$</span>
        <span className="font-mono text-[12px] text-zinc-300 truncate">{result.cmd}</span>
        <RoleBadge role={agent} />
        <span
          className={cn(
            'ml-auto shrink-0 rounded-lg px-2 py-0.5 text-[10px] font-bold',
            passed ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/15 text-red-400 border border-red-500/20',
          )}
        >
          exit {result.exitCode}
        </span>
      </div>
      {output && (
        <pre className="px-3 pt-2 pb-1 font-mono text-[11px] leading-relaxed text-zinc-350 overflow-auto whitespace-pre-wrap" style={{ maxHeight: '180px' }}>
          {!expanded && lines.length > 12 && (
            <div className="text-zinc-600 italic mb-1">…{lines.length - 12} lines hidden</div>
          )}
          {previewLines.map((line, i) => (
            <div key={i} className={result.stderr && !passed && i === previewLines.length - 1 ? 'text-red-400' : ''}>
              {line}
            </div>
          ))}
        </pre>
      )}
      {lines.length > 12 && (
        <div className="px-3 pb-2">
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="text-[10px] text-zinc-600 hover:text-zinc-400 transition cursor-pointer underline"
          >
            {expanded ? 'Show less' : 'Show all output'}
          </button>
        </div>
      )}
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
    <div className="overflow-hidden rounded-xl border border-white/10 bg-black/30">
      <div className="flex items-center gap-2 border-b border-white/5 px-3 py-2">
        <span className="text-[12px] text-zinc-300">{label}</span>
        <span className="ml-auto">
          <RoleBadge role={agent} />
        </span>
      </div>
      <img src={image} alt={label} className="w-full rounded-b-xl" />
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
    <div className={cn(
      'rounded-xl border p-4 space-y-3 animate-fade-in',
      status === 'pending'
        ? 'border-[var(--brass)]/40 bg-[var(--brass)]/8'
        : status === 'approved'
          ? 'border-emerald-500/25 bg-emerald-500/5'
          : 'border-zinc-700/40 bg-white/[0.02]'
    )}>
      <div className="flex items-start gap-2.5">
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-semibold text-zinc-100">{action}</div>
          <div className="mt-0.5 text-[12px] text-zinc-400 leading-relaxed">{detail}</div>
        </div>
      </div>
      {status === 'pending' ? (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onApprove}
            className="flex-1 rounded-lg bg-[var(--brass)] py-2 text-xs font-bold text-black transition hover:brightness-110 cursor-pointer"
          >
            ✓ Approve
          </button>
          <button
            type="button"
            onClick={onReject}
            className="flex-1 rounded-lg border border-zinc-700 py-2 text-xs font-medium text-zinc-400 transition hover:border-zinc-500 cursor-pointer"
          >
            ✕ Reject
          </button>
        </div>
      ) : (
        <div
          className={cn(
            'text-xs font-semibold',
            status === 'approved' ? 'text-emerald-400' : 'text-zinc-600',
          )}
        >
          {status === 'approved' ? '✓ Approved' : '✕ Rejected'}
        </div>
      )}
    </div>
  )
}

export function SpendApprovalCard({
  blockUsd,
  detail,
  status,
  onApprove,
  onReject,
}: {
  blockUsd: number
  detail: string
  status: 'pending' | 'approved' | 'rejected'
  onApprove: () => void
  onReject: () => void
}) {
  return (
    <div className={cn(
      'rounded-xl border p-4 space-y-3 animate-fade-in',
      status === 'pending'
        ? 'border-amber-500/40 bg-amber-500/8'
        : status === 'approved'
          ? 'border-emerald-500/25 bg-emerald-500/5'
          : 'border-zinc-700/40 bg-white/[0.02]'
    )}>
      <div className="flex items-start gap-2.5">
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-semibold text-zinc-100">Credit Extension Required</div>
          <div className="mt-0.5 text-[12px] text-zinc-400 leading-relaxed">{detail}</div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-lg font-bold text-amber-400">${blockUsd.toFixed(2)}</div>
          <div className="text-[9px] text-zinc-600">to extend</div>
        </div>
      </div>
      {status === 'pending' ? (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onApprove}
            className="flex-1 rounded-lg bg-amber-500 py-2 text-xs font-bold text-black transition hover:brightness-110 cursor-pointer"
          >
            ✓ Approve ${blockUsd.toFixed(2)}
          </button>
          <button
            type="button"
            onClick={onReject}
            className="flex-1 rounded-lg border border-zinc-700 py-2 text-xs font-medium text-zinc-400 transition hover:border-zinc-500 cursor-pointer"
          >
            ✕ Stop Run
          </button>
        </div>
      ) : (
        <div className={cn('text-xs font-semibold', status === 'approved' ? 'text-emerald-400' : 'text-zinc-600')}>
          {status === 'approved' ? `✓ +$${blockUsd.toFixed(2)} credits added` : '✕ Run cancelled'}
        </div>
      )}
    </div>
  )
}

export function QuestionCard({
  question,
  options,
  isMultiSelect,
  status,
  selection,
  onSubmit,
}: {
  question: string
  options: string[]
  isMultiSelect: boolean
  status: 'pending' | 'answered'
  selection?: string[]
  onSubmit: (selection: string[]) => void
}) {
  const [selected, setSelected] = useState<string[]>([])

  function toggle(option: string) {
    if (isMultiSelect) {
      setSelected((curr) =>
        curr.includes(option) ? curr.filter((o) => o !== option) : [...curr, option]
      )
    } else {
      setSelected([option])
    }
  }

  function submit() {
    if (selected.length > 0) onSubmit(selected)
  }

  return (
    <div className="rounded-xl border border-[var(--brass)]/30 bg-[var(--brass)]/8 p-4 space-y-3 animate-fade-in">
      <div className="text-[13px] font-semibold text-zinc-100 flex items-start gap-2">
        <span className="text-[9px] text-[var(--brass)] bg-[var(--brass)]/15 px-1.5 py-0.5 rounded border border-[var(--brass)]/25 font-bold uppercase tracking-wider shrink-0 mt-0.5">
          {isMultiSelect ? 'Multi-select' : 'Choose one'}
        </span>
        <span className="leading-relaxed">{question}</span>
      </div>

      {status === 'pending' ? (
        <div className="space-y-1.5">
          {options.map((option) => {
            const isChecked = selected.includes(option)
            return (
              <button
                key={option}
                type="button"
                onClick={() => toggle(option)}
                className={cn(
                  'w-full text-left rounded-lg border px-3 py-2.5 text-xs transition flex items-center justify-between cursor-pointer',
                  isChecked
                    ? 'border-[var(--brass)] bg-[var(--brass)]/15 text-[var(--brass)] font-semibold'
                    : 'border-white/8 bg-black/25 text-zinc-300 hover:bg-black/40 hover:border-white/15'
                )}
              >
                <span>{option}</span>
                {isChecked && <span className="text-[11px] font-bold text-[var(--brass)]">✓</span>}
              </button>
            )
          })}
          <button
            type="button"
            disabled={selected.length === 0}
            onClick={submit}
            className="w-full mt-1 rounded-lg bg-[var(--brass)] py-2.5 text-center text-xs font-bold text-black transition hover:brightness-110 disabled:opacity-40 cursor-pointer"
          >
            Submit {isMultiSelect ? `(${selected.length} selected)` : 'Selection'}
          </button>
        </div>
      ) : (
        <div className="space-y-1.5">
          {options.map((option) => {
            const wasSelected = selection?.includes(option)
            return (
              <div
                key={option}
                className={cn(
                  'rounded-lg border px-3 py-2 text-xs opacity-70 flex items-center justify-between',
                  wasSelected
                    ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-400 font-semibold'
                    : 'border-white/5 bg-black/15 text-zinc-550'
                )}
              >
                <span>{option}</span>
                {wasSelected && <span className="text-[10px] font-bold text-emerald-400">✓</span>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
