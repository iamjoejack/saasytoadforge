'use client'

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { useAgent } from '@/lib/agent-store'
import { Toad } from '@/components/Toad'
import { cn } from '@/lib/cn'
import type { SessionDto } from '@forge/shared'
import * as client from '@/lib/forge-client'
import {
  MessageBubble,
  ThinkingBubble,
  PlanView,
  DiffView,
  TerminalView,
  ScreenshotView,
  ApprovalCard,
  SpendApprovalCard,
  QuestionCard,
} from './artifacts'

// ── Spend meter bar ──────────────────────────────────────────────────────────
function SpendMeter() {
  const spendUsd = useAgent((s) => s.spendUsd)
  const [cap, setCap] = useState<number | null>(null)

  useEffect(() => {
    client.getConfig().then((c) => setCap(c.caps.perUserUsd)).catch(() => {})
  }, [])

  if (spendUsd === null || cap === null) return null

  const pct = Math.min(100, (spendUsd / cap) * 100)
  const color = pct < 60 ? 'bg-emerald-500' : pct < 85 ? 'bg-amber-500' : 'bg-red-500'
  const textColor = pct < 60 ? 'text-emerald-400' : pct < 85 ? 'text-amber-400' : 'text-red-400'

  return (
    <div className="px-3 py-1.5 border-b border-white/5 bg-black/20 select-none">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-600">Credits used</span>
        <span className={cn('text-[10px] font-bold tabular-nums', textColor)}>
          ${spendUsd.toFixed(4)} / ${cap.toFixed(2)}
        </span>
      </div>
      <div className="h-1 w-full rounded-full bg-zinc-850 overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-700', color)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

// ── Session history list ─────────────────────────────────────────────────────
function SessionHistory({ workspaceId, onClose }: { workspaceId: string; onClose: () => void }) {
  const [sessions, setSessions] = useState<SessionDto[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    client.getSessions(workspaceId)
      .then(setSessions)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [workspaceId])

  return (
    <div className="flex flex-col h-full bg-[#0c0c0e]">
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/5">
        <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Session History</span>
        <button
          type="button"
          onClick={onClose}
          className="text-zinc-500 hover:text-zinc-300 text-lg leading-none cursor-pointer"
        >
          ×
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {loading ? (
          <p className="text-[11px] text-zinc-600 px-2 py-3 text-center">Loading sessions…</p>
        ) : sessions.length === 0 ? (
          <p className="text-[11px] text-zinc-600 px-2 py-3 text-center">No sessions yet.</p>
        ) : (
          sessions.slice().reverse().map((s) => (
            <div
              key={s.id}
              className="rounded-lg border border-white/5 bg-black/20 px-3 py-2 hover:border-white/10 hover:bg-black/30 transition cursor-default"
            >
              <p className="text-[12px] text-zinc-300 line-clamp-2 leading-snug">{s.task}</p>
              <p className="mt-1 text-[10px] text-zinc-600">
                {new Date(s.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// ── Zapier Panel ─────────────────────────────────────────────────────────────
function ZapierPanel({ workspaceId }: { workspaceId: string }) {
  const [webhookUrl, setWebhookUrl] = useState('')
  const [triggerEvent, setTriggerEvent] = useState('user.registered')
  const [triggerStatus, setTriggerStatus] = useState<'idle' | 'sending' | 'success' | 'failed'>('idle')
  const [triggerLogs, setTriggerLogs] = useState('')

  useEffect(() => {
    try {
      const saved = localStorage.getItem('forge:zapier_webhook') || ''
      setWebhookUrl(saved)
    } catch { /* ignore */ }
  }, [])

  function saveWebhook(val: string) {
    setWebhookUrl(val)
    try { localStorage.setItem('forge:zapier_webhook', val) } catch { /* ignore */ }
  }

  async function handleSendTrigger() {
    if (!webhookUrl) return
    setTriggerStatus('sending')
    setTriggerLogs(`Firing POST webhook trigger → ${webhookUrl}\n`)

    const payload = {
      event: triggerEvent,
      workspaceId,
      timestamp: new Date().toISOString(),
      data: triggerEvent === 'user.registered' ? {
        id: 'usr_9x8f0a', email: 'novice-builder@saasytoad.dev', name: 'Novice Builder', plan: 'Pro Builder'
      } : triggerEvent === 'payment.succeeded' ? {
        id: 'txn_3f0a91', amount: 29.00, currency: 'usd', customer: 'novice-builder@saasytoad.dev'
      } : {
        id: 'form_7a0d11', formName: 'Contact Us', fields: { subject: 'Help with Zapier setup', message: 'This workspace is productive!' }
      }
    }

    try {
      await fetch(webhookUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload), mode: 'no-cors' })
      setTriggerStatus('success')
      setTriggerLogs((p) => p + `✓ Trigger sent:\n${JSON.stringify(payload, null, 2)}\n\nZapier trigger success!`)
    } catch (err) {
      setTriggerStatus('failed')
      setTriggerLogs((p) => p + `Failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return (
    <div className="flex flex-col p-4 space-y-4 overflow-y-auto flex-1">
      <div>
        <h3 className="font-cinzel text-xs font-bold text-zinc-300 uppercase tracking-wider">Zapier Automation</h3>
        <p className="mt-1 text-[11px] text-zinc-550 leading-relaxed">
          Link sandbox events to Zapier webhook triggers.
        </p>
      </div>
      <div className="space-y-1.5 border-t border-white/5 pt-3">
        <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-450 block">Zapier Webhook URL</label>
        <input
          type="text"
          value={webhookUrl}
          onChange={(e) => saveWebhook(e.target.value)}
          placeholder="https://hooks.zapier.com/hooks/catch/..."
          className="w-full rounded-lg bg-black/40 border border-white/10 px-3 py-1.5 text-xs text-zinc-350 placeholder:text-zinc-650 focus:border-[var(--brass)]/50 focus:outline-none"
        />
      </div>
      <div className="space-y-1.5 border-t border-white/5 pt-3">
        <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-450 block">Event Type</label>
        <select
          value={triggerEvent}
          onChange={(e) => setTriggerEvent(e.target.value)}
          className="w-full rounded-lg bg-black/80 border border-white/10 px-2.5 py-1.5 text-xs text-zinc-350 focus:border-[var(--brass)]/50 focus:outline-none cursor-pointer"
        >
          <option value="user.registered">User Registration</option>
          <option value="payment.succeeded">Stripe Checkout Success</option>
          <option value="form.submitted">Contact Form Submission</option>
        </select>
      </div>
      <button
        type="button"
        disabled={!webhookUrl || triggerStatus === 'sending'}
        onClick={handleSendTrigger}
        className="w-full rounded-lg bg-zinc-800 text-[var(--brass)] border border-[var(--brass)]/30 hover:bg-zinc-750 px-3 py-2 text-xs font-semibold uppercase tracking-wider cursor-pointer disabled:opacity-50 transition"
      >
        {triggerStatus === 'sending' ? 'Sending…' : 'Fire webhook'}
      </button>
      {triggerLogs && (
        <div className="border-t border-white/5 pt-3 flex flex-col min-h-[160px] flex-1">
          <span className="text-[9px] uppercase font-bold text-zinc-550 tracking-wider">Webhook Logs</span>
          <pre className="mt-1.5 flex-1 rounded-lg bg-black/60 p-3 font-mono text-[9px] text-emerald-450 overflow-auto border border-white/5 whitespace-pre-wrap">
            {triggerLogs}
          </pre>
        </div>
      )}
    </div>
  )
}

// ── Main AgentPanel ──────────────────────────────────────────────────────────
export function AgentPanel({ workspaceId }: { workspaceId: string }) {
  const connect = useAgent((s) => s.connect)
  const disconnect = useAgent((s) => s.disconnect)
  const connected = useAgent((s) => s.connected)
  const running = useAgent((s) => s.running)
  const timeline = useAgent((s) => s.timeline)
  const requireWriteApproval = useAgent((s) => s.requireWriteApproval)
  const setRequireWriteApproval = useAgent((s) => s.setRequireWriteApproval)
  const runTask = useAgent((s) => s.runTask)
  const cancelRun = useAgent((s) => s.cancelRun)
  const respond = useAgent((s) => s.respond)
  const respondSpend = useAgent((s) => s.respondSpend)
  const respondQuestion = useAgent((s) => s.respondQuestion)
  const acceptEdit = useAgent((s) => s.acceptEdit)
  const rejectEdit = useAgent((s) => s.rejectEdit)
  const clearTimeline = useAgent((s) => s.clearTimeline)
  const modelTier = useAgent((s) => s.modelTier)
  const setModelTier = useAgent((s) => s.setModelTier)
  const customModelId = useAgent((s) => s.customModelId)
  const setCustomModelId = useAgent((s) => s.setCustomModelId)

  const [input, setInput] = useState('')
  const [activePanelTab, setActivePanelTab] = useState<'agent' | 'zapier'>('agent')
  const [showHistory, setShowHistory] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    connect(workspaceId)
    return () => disconnect()
  }, [workspaceId, connect, disconnect])

  useEffect(() => {
    if (activePanelTab === 'agent') {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
    }
  }, [timeline, activePanelTab, running])

  // Auto-resize the textarea as the user types
  useEffect(() => {
    const ta = inputRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`
  }, [input])

  // Autocomplete & Attached Files states
  const [attachedFiles, setAttachedFiles] = useState<string[]>([])
  const [showFileSuggest, setShowFileSuggest] = useState(false)
  const [showCommandSuggest, setShowCommandSuggest] = useState(false)
  const [suggestFilter, setSuggestFilter] = useState('')
  const [suggestIndex, setSuggestIndex] = useState(0)
  const [suggestFiles, setSuggestFiles] = useState<string[]>([])

  const COMMANDS = useMemo(() => [
    { id: '/goal', label: '/goal <task>', desc: 'Run a thorough, goal-driven task' },
    { id: '/explain', label: '/explain <file>', desc: 'Ask the agent to explain a file' },
    { id: '/write-tests', label: '/write-tests <file>', desc: 'Ask the agent to write tests' },
    { id: '/clear', label: '/clear', desc: 'Clear the chat timeline history' },
    { id: '/stop', label: '/stop', desc: 'Stop the active agent execution' },
    { id: '/help', label: '/help', desc: 'Display a list of commands' },
  ], [])

  const filteredFiles = useMemo(() => {
    if (!suggestFilter) return suggestFiles.slice(0, 15)
    const f = suggestFilter.toLowerCase()
    return suggestFiles.filter((file) => file.toLowerCase().includes(f)).slice(0, 15)
  }, [suggestFiles, suggestFilter])

  const filteredCommands = useMemo(() => {
    if (!suggestFilter) return [...COMMANDS]
    const f = suggestFilter.toLowerCase()
    return COMMANDS.filter((cmd) => cmd.id.includes(f) || cmd.desc.toLowerCase().includes(f))
  }, [COMMANDS, suggestFilter])

  const fetchFlatFiles = useCallback(async (dir = '', depth = 0): Promise<string[]> => {
    if (depth > 4) return []
    try {
      const entries = await client.listFiles(workspaceId, dir)
      const files: string[] = []
      for (const entry of entries) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'build' || entry.name === '.git') continue
        if (entry.type === 'file') {
          files.push(entry.path)
        } else {
          const sub = await fetchFlatFiles(entry.path, depth + 1)
          files.push(...sub)
        }
      }
      return files.slice(0, 100)
    } catch {
      return []
    }
  }, [workspaceId])

  const loadWorkspaceFiles = useCallback(async () => {
    const files = await fetchFlatFiles()
    setSuggestFiles(files)
  }, [fetchFlatFiles])

  const selectFile = useCallback((filePath: string) => {
    setAttachedFiles((prev) => {
      if (prev.includes(filePath)) return prev
      return [...prev, filePath]
    })
    const val = input
    const selStart = inputRef.current?.selectionStart ?? 0
    const before = val.slice(0, selStart)
    const after = val.slice(selStart)
    const replacedBefore = before.replace(/@[^\s@]*$/, '')
    setInput(replacedBefore + after)
    setShowFileSuggest(false)
    
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus()
        const newPos = replacedBefore.length
        inputRef.current.setSelectionRange(newPos, newPos)
      }
    }, 10)
  }, [input])

  const selectCommand = useCallback((cmd: typeof COMMANDS[number]) => {
    if (cmd.id === '/clear') {
      clearTimeline()
      setInput('')
      setShowCommandSuggest(false)
      return
    }
    if (cmd.id === '/stop') {
      cancelRun()
      setInput('')
      setShowCommandSuggest(false)
      return
    }

    const val = input
    const selStart = inputRef.current?.selectionStart ?? 0
    const before = val.slice(0, selStart)
    const after = val.slice(selStart)

    if (cmd.id === '/explain' || cmd.id === '/write-tests') {
      const replacedBefore = before.replace(/\/([^\s/]*)$/, `${cmd.id} @`)
      setInput(replacedBefore + after)
      setShowCommandSuggest(false)
      setShowFileSuggest(true)
      setSuggestFilter('')
      setSuggestIndex(0)
      void loadWorkspaceFiles()
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus()
          const newPos = replacedBefore.length
          inputRef.current.setSelectionRange(newPos, newPos)
        }
      }, 10)
      return
    }

    const replacedBefore = before.replace(/\/([^\s/]*)$/, `${cmd.id} `)
    setInput(replacedBefore + after)
    setShowCommandSuggest(false)

    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus()
        const newPos = replacedBefore.length
        inputRef.current.setSelectionRange(newPos, newPos)
      }
    }, 10)
  }, [input, clearTimeline, cancelRun, COMMANDS, loadWorkspaceFiles])

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    setInput(val)

    const selStart = e.target.selectionStart ?? 0
    const textBefore = val.slice(0, selStart)
    
    const atMatch = textBefore.match(/@([^\s@]*)$/)
    if (atMatch) {
      const filter = atMatch[1] ?? ''
      setSuggestFilter(filter)
      setShowFileSuggest(true)
      setShowCommandSuggest(false)
      setSuggestIndex(0)
      void loadWorkspaceFiles()
    } else {
      setShowFileSuggest(false)
    }

    const slashMatch = textBefore.match(/\/([^\s/]*)$/)
    const isStartOfWord = textBefore.length === 1 || /\s\/[^\s/]*$/.test(textBefore)
    if (slashMatch && isStartOfWord) {
      const filter = slashMatch[1] ?? ''
      setSuggestFilter(filter)
      setShowCommandSuggest(true)
      setShowFileSuggest(false)
      setSuggestIndex(0)
    } else {
      setShowCommandSuggest(false)
    }
  }

  const handleAttachClick = useCallback(() => {
    setShowFileSuggest(true)
    setSuggestFilter('')
    setSuggestIndex(0)
    void loadWorkspaceFiles()
    inputRef.current?.focus()
  }, [loadWorkspaceFiles])

  const submit = useCallback(async () => {
    let taskText = input.trim()
    if (!taskText || running) return
    setInput('')
    if (inputRef.current) inputRef.current.style.height = 'auto'

    if (taskText === '/help') {
      useAgent.setState((s) => ({
        timeline: [
          ...s.timeline,
          { id: Math.random().toString(), kind: 'message', role: 'user', text: '/help', ts: Date.now() },
          {
            id: Math.random().toString(),
            kind: 'message',
            role: 'assistant',
            text: `### Available Commands\n\n- \`/goal <task>\` - Run a thorough, goal-driven task\n- \`/explain <file>\` - Explain a file's code\n- \`/write-tests <file>\` - Generate unit tests for a file\n- \`/clear\` - Clear this session's chat history\n- \`/stop\` - Cancel the active agent run\n- \`/help\` - Show this help menu\n\n*Tip: Type \`@\` to mention files, or click the \`+\` button to attach them as context.*`,
            ts: Date.now()
          }
        ]
      }))
      return
    }

    if (taskText === '/clear') {
      clearTimeline()
      return
    }

    if (taskText === '/stop') {
      cancelRun()
      return
    }

    let commandPrefix = ''
    if (taskText.startsWith('/goal ')) {
      commandPrefix = '[Goal-driven Execution Requested]: Please plan thoroughly and verify correctness using the workspace compiler and test runs.\n\n'
      taskText = taskText.slice(6)
    } else if (taskText.startsWith('/explain ')) {
      commandPrefix = 'Please explain the following code and walk through how it works:\n\n'
      taskText = taskText.slice(9)
    } else if (taskText.startsWith('/write-tests ')) {
      commandPrefix = 'Please generate complete unit tests for the following file:\n\n'
      taskText = taskText.slice(13)
    }

    const inlineMentions = taskText.match(/@[^\s@]+/g)
    const allAttachments = [...attachedFiles]
    if (inlineMentions) {
      inlineMentions.forEach((mention) => {
        const file = mention.slice(1)
        if (!allAttachments.includes(file)) {
          allAttachments.push(file)
        }
      })
    }

    let finalPrompt = taskText
    if (allAttachments.length > 0) {
      try {
        const fileContexts = await Promise.all(allAttachments.map(async (file) => {
          try {
            const contents = await client.readFile(workspaceId, file)
            return `=== Context File: ${file} ===\n${contents}\n=== End of File ===`
          } catch {
            return `=== Context File: ${file} (Failed to read content) ===`
          }
        }))
        finalPrompt = `${fileContexts.join('\n\n')}\n\n${commandPrefix}${taskText}`
      } catch {
        finalPrompt = `${commandPrefix}${taskText}`
      }
    } else {
      finalPrompt = `${commandPrefix}${taskText}`
    }

    setAttachedFiles([])
    runTask(finalPrompt)
  }, [input, running, runTask, workspaceId, attachedFiles, clearTimeline, cancelRun])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showFileSuggest || showCommandSuggest) {
      const listLength = showFileSuggest
        ? filteredFiles.length
        : filteredCommands.length

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSuggestIndex((prev) => (listLength > 0 ? (prev + 1) % listLength : 0))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSuggestIndex((prev) => (listLength > 0 ? (prev - 1 + listLength) % listLength : 0))
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        if (showFileSuggest && filteredFiles[suggestIndex]) {
          selectFile(filteredFiles[suggestIndex])
        } else if (showCommandSuggest && filteredCommands[suggestIndex]) {
          selectCommand(filteredCommands[suggestIndex])
        }
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setShowFileSuggest(false)
        setShowCommandSuggest(false)
        return
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void submit()
    }
  }, [showFileSuggest, showCommandSuggest, suggestIndex, filteredFiles, filteredCommands, selectFile, selectCommand, submit])

  const hasAgentContent = timeline.some((t) => t.kind !== 'message' || t.role === 'assistant')
  const showThinking = running && !hasAgentContent

  return (
    <div className="flex h-full flex-col bg-[#0c0c0e] relative">
      {/* ── Tab Header ── */}
      <div className="flex border-b border-white/5 bg-black/25 text-[11px]">
        <button
          type="button"
          onClick={() => { setActivePanelTab('agent'); setShowHistory(false) }}
          className={cn(
            'flex-1 text-center py-2 font-bold uppercase tracking-wider cursor-pointer border-b transition flex items-center justify-center gap-1.5',
            activePanelTab === 'agent' && !showHistory
              ? 'border-[var(--brass)] text-[var(--brass)] bg-white/[0.02]'
              : 'border-transparent text-zinc-500 hover:text-zinc-350'
          )}
        >
          Agent
        </button>
        <button
          type="button"
          onClick={() => { setActivePanelTab('agent'); setShowHistory(true) }}
          className={cn(
            'flex-1 text-center py-2 font-bold uppercase tracking-wider cursor-pointer border-b transition flex items-center justify-center gap-1.5',
            showHistory
              ? 'border-[var(--brass)] text-[var(--brass)] bg-white/[0.02]'
              : 'border-transparent text-zinc-500 hover:text-zinc-350'
          )}
        >
          Sessions
        </button>
        <button
          type="button"
          onClick={() => { setActivePanelTab('zapier'); setShowHistory(false) }}
          className={cn(
            'flex-1 text-center py-2 font-bold uppercase tracking-wider cursor-pointer border-b transition flex items-center justify-center gap-1.5',
            activePanelTab === 'zapier' && !showHistory
              ? 'border-[var(--brass)] text-[var(--brass)] bg-white/[0.02]'
              : 'border-transparent text-zinc-500 hover:text-zinc-350'
          )}
        >
          Zapier
        </button>
      </div>

      {/* ── Session History Overlay ── */}
      {showHistory && (
        <div className="absolute inset-0 z-10 mt-9">
          <SessionHistory workspaceId={workspaceId} onClose={() => setShowHistory(false)} />
        </div>
      )}

      {/* ── Zapier Panel ── */}
      {activePanelTab === 'zapier' && !showHistory && (
        <div className="flex flex-1 flex-col min-h-0 overflow-y-auto">
          <ZapierPanel workspaceId={workspaceId} />
        </div>
      )}

      {/* ── Agent Chat Panel ── */}
      {activePanelTab === 'agent' && !showHistory && (
        <div className="flex flex-1 flex-col min-h-0">
          {/* Sub-header: status + actions */}
          <div className="flex items-center gap-2 border-b border-white/5 px-3 py-1.5 bg-black/10">
            <Toad className="h-4 w-4" />
            <span className="text-[12px] font-semibold text-zinc-300">Ronald Pipeline</span>
            <span className="ml-auto inline-flex items-center gap-1.5 text-[10px] text-zinc-550">
              <span
                className={cn(
                  'h-1.5 w-1.5 rounded-full',
                  running ? 'animate-pulse bg-[var(--brass)]' : connected ? 'bg-emerald-500' : 'bg-zinc-650',
                )}
              />
              {running ? 'working' : connected ? 'ready' : 'offline'}
            </span>
            {/* Clear button */}
            {timeline.length > 0 && !running && (
              <button
                type="button"
                onClick={clearTimeline}
                title="Clear conversation"
                className="ml-1 text-[10px] text-zinc-600 hover:text-zinc-400 transition cursor-pointer px-1.5 py-0.5 rounded hover:bg-white/5"
              >
                Clear
              </button>
            )}
            {/* Stop button */}
            {running && (
              <button
                type="button"
                onClick={cancelRun}
                className="ml-1 text-[10px] font-bold text-red-400 hover:text-red-300 transition cursor-pointer px-2 py-0.5 rounded border border-red-500/30 bg-red-500/10 hover:bg-red-500/15"
              >
                Stop
              </button>
            )}
          </div>

          {/* Spend meter is relocated below the scroll area, above the input box */}

          {/* Timeline scroll area */}
          <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-auto p-3">
            {timeline.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center px-4 text-center select-none">
                <Toad className="h-12 w-12 opacity-70" />
                <p className="mt-4 text-sm text-zinc-350 font-cinzel tracking-wide">Ronald Agent Workbench</p>
                <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-500 max-w-[230px]">
                  Describe a task and the AI crew will execute compiler runs and file modifications directly in your workspace.
                </p>
                <div className="mt-4 flex flex-col gap-1.5 w-full max-w-[240px]">
                  {[
                    'Build a landing page with Tailwind',
                    'Add Stripe checkout to my app',
                    'Write unit tests for my API',
                  ].map((hint) => (
                    <button
                      key={hint}
                      type="button"
                      onClick={() => { setInput(hint); inputRef.current?.focus() }}
                      className="w-full rounded-lg border border-white/8 bg-black/20 px-3 py-2 text-[11px] text-zinc-400 hover:border-white/15 hover:text-zinc-300 transition cursor-pointer text-left"
                    >
                      {hint}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {timeline.map((item, index) => {
                  switch (item.kind) {
                    case 'message': {
                      const isLatest = index === timeline.length - 1
                      const isStreaming = isLatest && running && item.role === 'assistant'
                      return (
                        <MessageBubble
                          key={item.id}
                          role={item.role}
                          text={item.text}
                          agent={item.agent}
                          ts={item.ts}
                          isStreaming={isStreaming}
                        />
                      )
                    }
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
                    case 'spend_approval':
                      return (
                        <SpendApprovalCard
                          key={item.id}
                          blockUsd={item.blockUsd}
                          detail={item.detail}
                          status={item.status}
                          onApprove={() => respondSpend(item.approvalId, item.blockUsd, true)}
                          onReject={() => respondSpend(item.approvalId, item.blockUsd, false)}
                        />
                      )
                    case 'question':
                      return (
                        <QuestionCard
                          key={item.id}
                          question={item.question}
                          options={item.options}
                          isMultiSelect={item.isMultiSelect}
                          status={item.status}
                          selection={item.selection}
                          onSubmit={(selection) => respondQuestion(item.questionId, selection)}
                        />
                      )
                    case 'error':
                      return (
                        <div key={item.id} className="rounded-xl bg-red-500/10 border border-red-500/25 px-3.5 py-3 text-[13px] text-red-400 flex items-start gap-2">
                          <div className="flex-1">
                            <span>{item.text}</span>
                            {item.text && (
                              <button
                                type="button"
                                className="ml-2 text-[11px] underline text-red-300 hover:text-red-200 cursor-pointer"
                                onClick={() => {
                                  // Find the last user message and re-send it
                                  const lastUser = [...timeline].reverse().find((t) => t.kind === 'message' && t.role === 'user')
                                  if (lastUser && lastUser.kind === 'message') runTask(lastUser.text)
                                }}
                              >
                                Retry
                              </button>
                            )}
                          </div>
                        </div>
                      )
                  }
                })}
                {showThinking && <ThinkingBubble />}
              </>
            )}
          </div>

          {/* Spend meter bar progress indicator */}
          <SpendMeter />

          {/* ── Compose Area ── */}
          <div className="border-t border-white/5 p-3 bg-black/10 relative">
            {/* File Mentions Popup */}
            {showFileSuggest && filteredFiles.length > 0 && (
              <div className="absolute bottom-full left-3 right-3 z-20 mb-2 max-h-48 overflow-y-auto rounded-xl border border-white/10 bg-[#0c0c0e]/95 backdrop-blur-md p-1.5 shadow-2xl select-none">
                <div className="px-2 py-1 text-[9px] font-bold text-zinc-550 uppercase tracking-wider">Workspace Files</div>
                {filteredFiles.map((file, i) => (
                  <button
                    key={file}
                    type="button"
                    onClick={() => selectFile(file)}
                    className={cn(
                      'w-full text-left text-xs px-2.5 py-1.5 rounded-lg flex items-center gap-2 cursor-pointer transition',
                      i === suggestIndex ? 'bg-[var(--brass)]/15 text-[var(--brass)] font-semibold' : 'text-zinc-350 hover:bg-white/[0.03]'
                    )}
                  >
                    <span className="truncate">{file}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Commands Popup */}
            {showCommandSuggest && filteredCommands.length > 0 && (
              <div className="absolute bottom-full left-3 right-3 z-20 mb-2 max-h-48 overflow-y-auto rounded-xl border border-white/10 bg-[#0c0c0e]/95 backdrop-blur-md p-1.5 shadow-2xl select-none">
                <div className="px-2 py-1 text-[9px] font-bold text-zinc-550 uppercase tracking-wider">Action Commands</div>
                {filteredCommands.map((cmd, i) => (
                  <button
                    key={cmd.id}
                    type="button"
                    onClick={() => selectCommand(cmd)}
                    className={cn(
                      'w-full text-left text-xs px-2.5 py-1.5 rounded-lg flex items-center justify-between cursor-pointer transition',
                      i === suggestIndex ? 'bg-[var(--brass)]/15 text-[var(--brass)] font-semibold' : 'text-zinc-350 hover:bg-white/[0.03]'
                    )}
                  >
                    <span className="font-mono">{cmd.label}</span>
                    <span className="text-[10px] text-zinc-550">{cmd.desc}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Attached file capsules row */}
            {attachedFiles.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5 select-none">
                {attachedFiles.map((file) => (
                  <span key={file} className="inline-flex items-center gap-1 rounded bg-zinc-800 border border-zinc-700 px-2 py-0.5 text-[10px] text-zinc-300">
                    <span>{file}</span>
                    <button
                      type="button"
                      onClick={() => setAttachedFiles((prev) => prev.filter((f) => f !== file))}
                      className="text-zinc-500 hover:text-zinc-300 ml-0.5 cursor-pointer font-bold"
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Controls row */}
            <div className="mb-2 flex items-center gap-2 text-[10px] text-zinc-550 select-none">
              <label className="flex items-center gap-1.5 cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={requireWriteApproval}
                  onChange={(e) => setRequireWriteApproval(e.target.checked)}
                  className="accent-[var(--brass)] cursor-pointer"
                />
                approve writes
              </label>

              {/* @ mention hint */}
              <span className="text-zinc-700 shrink-0">|</span>
              <span className="text-zinc-650 shrink-0">@ to mention, / for actions</span>
            </div>

            {/* Auto-resizing textarea input */}
            <div className={cn(
              'flex items-end gap-2 rounded-xl border bg-black/40 px-3 py-2 transition',
              running ? 'border-[var(--brass)]/20' : 'border-white/10 focus-within:border-white/20'
            )}>
              {/* + attachment button */}
              <button
                type="button"
                onClick={handleAttachClick}
                title="Attach file context"
                className="shrink-0 mb-0.5 rounded p-1 text-zinc-600 hover:text-zinc-400 hover:bg-white/5 transition cursor-pointer"
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>

              <textarea
                ref={inputRef}
                rows={1}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder={running ? 'Agent is working…' : 'Ask anything, @ to mention, / for actions'}
                disabled={running}
                className="w-full resize-none bg-transparent text-xs text-zinc-150 placeholder:text-zinc-650 focus:outline-none leading-relaxed disabled:opacity-50"
                style={{ minHeight: '20px', maxHeight: '120px' }}
              />
              <button
                type="button"
                onClick={() => void submit()}
                disabled={running || input.trim().length === 0}
                title="Send task (Enter)"
                className="shrink-0 rounded-lg bg-[var(--brass)] p-1.5 text-xs font-semibold text-black transition hover:brightness-110 disabled:opacity-40 cursor-pointer"
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 19V5m-7 7l7-7 7 7" />
                </svg>
              </button>
            </div>

            {/* Model tier selector row — Antigravity style */}
            <div className="mt-1.5 flex items-center gap-2 select-none">
              <select
                value={modelTier}
                onChange={(e) => setModelTier(e.target.value as 'fast' | 'frontier' | 'fusion' | 'custom')}
                className="rounded-lg bg-black/60 border border-white/10 px-2 py-0.5 text-[10px] text-zinc-400 focus:border-[var(--brass)]/30 focus:outline-none cursor-pointer hover:border-white/15 transition appearance-none"
                style={{ paddingRight: '18px', backgroundImage: `url("data:image/svg+xml,%3Csvg fill='%23666' viewBox='0 0 20 20' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 4px center', backgroundSize: '12px' }}
              >
                <option value="fusion">Fusion (3-model panel)</option>
                <option value="frontier">Frontier (Sonnet)</option>
                <option value="fast">Fast (GPT-4o mini)</option>
                <option value="custom">Custom model</option>
              </select>

              {/* Custom Model ID Entry */}
              {modelTier === 'custom' && (
                <input
                  type="text"
                  placeholder="custom model ID"
                  value={customModelId}
                  onChange={(e) => setCustomModelId(e.target.value)}
                  className="rounded-lg bg-black/60 border border-white/10 px-2.5 py-0.5 text-[10px] text-zinc-300 focus:border-[var(--brass)]/30 focus:outline-none w-36 font-mono"
                />
              )}

              {/* Tier description */}
              <span className="text-[9px] text-zinc-700 truncate">
                {modelTier === 'fusion' ? 'Best reasoning · 3 models fused'
                  : modelTier === 'frontier' ? 'Claude Sonnet · single model'
                  : modelTier === 'fast' ? 'Cheapest · fast tasks'
                  : 'Specify custom OpenRouter model'}
              </span>

              {/* Caret up icon to show the dropdown is expandable */}
              <span className="text-[9px] text-zinc-700 ml-auto">▲</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
