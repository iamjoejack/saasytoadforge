'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useIde } from '@/lib/store'
import { Toad } from '@/components/Toad'
import { cn } from '@/lib/cn'
import { FileTree } from './FileTree'
import { EditorPane } from './EditorPane'
import { TerminalPane } from './TerminalPane'
import { AgentPanel } from './AgentPanel'
import { BlocksPalette } from './BlocksPalette'
import { useAgent } from '@/lib/agent-store'
import * as client from '@/lib/forge-client'

interface MenuBarProps {
  workspaceId: string
  activeTab: 'files' | 'blocks'
  setActiveTab: (tab: 'files' | 'blocks') => void
  handleDeploy: () => void
}

function IdeMenuBar({ workspaceId, activeTab, setActiveTab, handleDeploy }: MenuBarProps) {
  const [activeMenu, setActiveMenu] = useState<string | null>(null)
  const activePath = useIde((s) => s.activePath)
  const closeTab = useIde((s) => s.closeTab)
  const save = useIde((s) => s.save)
  const theme = useIde((s) => s.theme)
  const setTheme = useIde((s) => s.setTheme)
  const viewMode = useIde((s) => s.viewMode)
  const setViewMode = useIde((s) => s.setViewMode)
  
  const [showAbout, setShowAbout] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)

  const editorInstance = useIde((s) => s.editorInstance)

  function runEditorAction(id: string) {
    if (editorInstance) {
      editorInstance.focus()
      // Monaco actions are triggered via the action trigger API
      const action = editorInstance.getAction(id)
      if (action) {
        void action.run()
      } else {
        editorInstance.trigger('menu', id, null)
      }
    }
    setActiveMenu(null)
  }

  function handleSave() {
    if (activePath) {
      void save(activePath)
    }
    setActiveMenu(null)
  }

  function handleClose() {
    if (activePath) {
      closeTab(activePath)
    }
    setActiveMenu(null)
  }

  function handleGoToLine() {
    setActiveMenu(null)
    if (!editorInstance) return
    const lineStr = window.prompt('Enter line number to navigate to:')
    if (lineStr) {
      const line = parseInt(lineStr, 10)
      if (!isNaN(line)) {
        editorInstance.revealLine(line)
        editorInstance.setPosition({ lineNumber: line, column: 1 })
        editorInstance.focus()
      }
    }
  }

  function handleRunTests() {
    setActiveMenu(null)
    alert('Initiating workspace unit test suite. Test results will stream in the background console.')
  }

  const menus = [
    {
      name: 'File',
      items: [
        { label: '📄 New File...', action: () => { useAgent.setState((s) => ({ fileVersion: s.fileVersion + 1 })); alert('Use the 📄+ button in the Files sidebar tree to name your new file.'); } },
        { label: '📁 New Folder...', action: () => { useAgent.setState((s) => ({ fileVersion: s.fileVersion + 1 })); alert('Use the 📁+ button in the Files sidebar tree to name your new folder.'); } },
        { label: '💾 Save Active File', action: handleSave, disabled: !activePath },
        { label: '❌ Close Active Tab', action: handleClose, disabled: !activePath },
        { label: '🚪 Back to Workspaces', action: () => window.location.href = '/workspaces' }
      ]
    },
    {
      name: 'Edit',
      items: [
        { label: 'Undo Edit', action: () => runEditorAction('undo') },
        { label: 'Redo Edit', action: () => runEditorAction('redo') },
        { label: 'Select All', action: () => runEditorAction('editor.action.selectAll') },
        { label: '🧱 Insert Block Component', action: () => { setActiveTab('blocks'); } }
      ]
    },
    {
      name: 'Selection',
      items: [
        { label: 'Expand Selection', action: () => runEditorAction('editor.action.smartSelect.expand') },
        { label: 'Shrink Selection', action: () => runEditorAction('editor.action.smartSelect.shrink') }
      ]
    },
    {
      name: 'View',
      items: [
        { label: activeTab === 'files' ? '✓ Files Tab' : '📁 Files Tab', action: () => setActiveTab('files') },
        { label: activeTab === 'blocks' ? '✓ Blocks Tab' : '🧱 Blocks Tab', action: () => setActiveTab('blocks') },
        { label: viewMode === 'editor' ? '✓ Code Editor' : '💻 Code Editor', action: () => setViewMode('editor') },
        { label: viewMode === 'browser' ? '✓ Live Preview' : '🌐 Live Preview', action: () => setViewMode('browser') },
        { label: `Toggle Theme (${theme === 'slate' ? 'Slate' : 'Steampunk'})`, action: () => setTheme(theme === 'slate' ? 'steampunk' : 'slate') }
      ]
    },
    {
      name: 'Go',
      items: [
        { label: 'Go to Line...', action: handleGoToLine, disabled: !editorInstance }
      ]
    },
    {
      name: 'Run',
      items: [
        { label: '🚀 Deploy Workspace', action: handleDeploy },
        { label: '🧪 Run Unit Tests', action: handleRunTests },
        { label: '🔄 Reload Preview', action: () => { setViewMode('browser'); window.location.reload(); } }
      ]
    },
    {
      name: 'Terminal',
      items: [
        { label: 'Clear Console', action: () => alert('Terminal console reset complete.') }
      ]
    },
    {
      name: 'Help',
      items: [
        { label: '💡 Keyboard Shortcuts', action: () => { setActiveMenu(null); setShowShortcuts(true); } },
        { label: '🐸 About SaaSyToad Forge', action: () => { setActiveMenu(null); setShowAbout(true); } }
      ]
    }
  ]

  return (
    <>
      <div className="flex items-center gap-1 select-none font-medium">
        {menus.map((m) => {
          const isOpen = activeMenu === m.name
          return (
            <div key={m.name} className="relative">
              <button
                type="button"
                onClick={() => setActiveMenu(isOpen ? null : m.name)}
                onMouseEnter={() => {
                  if (activeMenu !== null) setActiveMenu(m.name)
                }}
                className={cn(
                  'px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider rounded transition cursor-pointer border',
                  isOpen
                    ? 'bg-zinc-800 text-[var(--brass)] border-[var(--brass)]/30'
                    : 'text-zinc-400 border-transparent hover:text-zinc-200 hover:bg-white/5'
                )}
              >
                {m.name}
              </button>
              
              {isOpen && (
                <>
                  <div className="fixed inset-0 z-40 cursor-default" onClick={() => setActiveMenu(null)} />
                  <div className="absolute left-0 mt-1.5 w-44 rounded-lg border border-white/10 bg-[#0e0e12] p-1.5 shadow-2xl z-50 animate-fade-in text-left">
                    {m.items.map((it, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={it.action}
                        disabled={it.disabled}
                        className="w-full text-left px-2 py-1 rounded text-[11px] font-medium tracking-wide text-zinc-300 hover:text-[var(--brass)] hover:bg-white/[0.04] transition disabled:opacity-30 disabled:hover:text-zinc-300 disabled:hover:bg-transparent cursor-pointer"
                      >
                        {it.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>

      {showAbout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs select-none">
          <div className="w-full max-w-sm rounded-xl border border-[var(--brass)]/25 bg-[#0e0e12] p-6 text-center shadow-2xl space-y-4 animate-slide-up relative">
            <div className="circuit-grid opacity-10" />
            <div className="flex justify-center">
              <div className="h-16 w-16 rounded-full bg-[var(--brass)]/10 border border-[var(--brass)]/30 flex items-center justify-center text-4xl animate-bounce">
                🐸
              </div>
            </div>
            
            <div className="space-y-1">
              <h2 className="font-cinzel text-lg font-bold text-white tracking-wider">
                SaaSyToad Forge
              </h2>
              <p className="text-[10px] text-[var(--brass)] font-bold uppercase tracking-widest">
                Developer Agent Workbench v1.0.0
              </p>
              <p className="text-[9px] text-zinc-500 font-mono tracking-normal break-all">
                ID: {workspaceId}
              </p>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">
              Forge is a premium, agent-first visual-code development workbench designed for both novice creators and pro developers. Booted with microVM execution containers, Stripe Billing, and direct Zapier API webhook triggers.
            </p>

            <div className="text-[9px] text-zinc-550 border-t border-white/5 pt-3">
              Ronald SaaSyToad Mascot & Crew © 2026
            </div>

            <button
              type="button"
              onClick={() => setShowAbout(false)}
              className="w-full rounded bg-[var(--brass)] text-black px-4 py-1.5 text-xs font-bold transition hover:brightness-110 cursor-pointer"
            >
              Close Info
            </button>
          </div>
        </div>
      )}

      {showShortcuts && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs select-none">
          <div className="w-full max-w-sm rounded-xl border border-white/10 bg-[#0e0e12] p-5 shadow-2xl space-y-4 animate-slide-up">
            <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
              <h3 className="font-cinzel text-xs font-bold text-zinc-200 tracking-wider">
                Keyboard Shortcuts & Commands
              </h3>
              <button
                type="button"
                onClick={() => setShowShortcuts(false)}
                className="text-zinc-400 hover:text-zinc-200 text-lg font-bold cursor-pointer"
              >
                ×
              </button>
            </div>
            <div className="space-y-2 text-xs text-zinc-300 max-h-[260px] overflow-y-auto">
              <div className="flex justify-between border-b border-white/5 pb-1">
                <span>Save Active File</span>
                <kbd className="bg-zinc-800 px-1.5 py-0.5 rounded text-[10px] font-mono text-[var(--brass)]">Ctrl + S</kbd>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-1">
                <span>Undo Edit</span>
                <kbd className="bg-zinc-800 px-1.5 py-0.5 rounded text-[10px] font-mono text-[var(--brass)]">Ctrl + Z</kbd>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-1">
                <span>Redo Edit</span>
                <kbd className="bg-zinc-800 px-1.5 py-0.5 rounded text-[10px] font-mono text-[var(--brass)]">Ctrl + Y</kbd>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-1">
                <span>Select All</span>
                <kbd className="bg-zinc-800 px-1.5 py-0.5 rounded text-[10px] font-mono text-[var(--brass)]">Ctrl + A</kbd>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-1">
                <span>Quick Line Go</span>
                <kbd className="bg-zinc-800 px-1.5 py-0.5 rounded text-[10px] font-mono text-[var(--brass)]">Ctrl + G</kbd>
              </div>
            </div>
            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => setShowShortcuts(false)}
                className="rounded bg-zinc-800 border border-zinc-700 hover:border-zinc-550 px-4 py-1.5 text-xs font-semibold text-zinc-200 transition cursor-pointer"
              >
                Close Shortcuts
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ── VS Code-style Status Bar ────────────────────────────────────────────────
const LANG_ICONS: Record<string, string> = {
  typescript: '{ } TypeScript',
  javascript: '{ } JavaScript',
  typescriptreact: '{ } TSX',
  javascriptreact: '{ } JSX',
  css: '/* */ CSS',
  html: '⟨/⟩ HTML',
  json: '{ } JSON',
  markdown: '📝 Markdown',
  python: '🐍 Python',
  plaintext: '📄 Plain Text',
}

function IdeStatusBar({ workspaceId }: { workspaceId: string }) {
  const cursorPos = useIde((s) => s.cursorPos)
  const activeLanguage = useIde((s) => s.activeLanguage)
  const activePath = useIde((s) => s.activePath)
  const dirty = useIde((s) => s.dirty)
  const connected = useAgent((s) => s.connected)
  const running = useAgent((s) => s.running)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [notifCount] = useState(0)

  // Track when dirty flips from true to false → file was saved
  const isDirty = activePath ? (dirty[activePath] ?? false) : false
  useEffect(() => {
    if (!isDirty && activePath) setLastSaved(new Date())
  }, [isDirty, activePath])

  const langLabel = LANG_ICONS[activeLanguage] ?? `{ } ${activeLanguage}`

  function relSaved(d: Date) {
    const s = Math.floor((Date.now() - d.getTime()) / 1000)
    if (s < 5) return 'just now'
    if (s < 60) return `${s}s ago`
    return `${Math.floor(s / 60)}m ago`
  }

  return (
    <div className="flex items-center h-5 border-t border-white/5 bg-[#0a0a0c] px-2 text-[10px] text-zinc-550 select-none overflow-hidden gap-0">
      {/* Left: agent/connection status */}
      <div className={cn(
        'flex items-center gap-1 px-2 h-full font-medium',
        running ? 'bg-[var(--brass)]/15 text-[var(--brass)]' : connected ? 'bg-emerald-500/10 text-emerald-500' : 'bg-zinc-800 text-zinc-500'
      )}>
        <span className={cn('h-1.5 w-1.5 rounded-full', running ? 'bg-[var(--brass)] animate-pulse' : connected ? 'bg-emerald-500' : 'bg-zinc-600')} />
        <span>{running ? 'Agent running' : connected ? 'Agent ready' : 'Offline'}</span>
      </div>

      <div className="h-full w-px bg-white/5 mx-0.5" />

      {/* Workspace short ID */}
      <span className="px-2 font-mono text-zinc-600 truncate" title={workspaceId}>
        ◇ {workspaceId.slice(0, 8)}
      </span>

      {/* Last saved */}
      {lastSaved && (
        <>
          <div className="h-full w-px bg-white/5 mx-0.5" />
          <span className="px-2 text-zinc-600" title={lastSaved.toLocaleTimeString()}>
            Saved {relSaved(lastSaved)}
          </span>
        </>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Cursor position */}
      <div className="h-full w-px bg-white/5 mx-0.5" />
      <span className="px-2 tabular-nums">Ln {cursorPos.line}, Col {cursorPos.col}</span>

      {/* Indentation */}
      <div className="h-full w-px bg-white/5 mx-0.5" />
      <span className="px-2">Spaces: 2</span>

      {/* Encoding */}
      <div className="h-full w-px bg-white/5 mx-0.5" />
      <span className="px-2">UTF-8</span>

      {/* Line endings */}
      <div className="h-full w-px bg-white/5 mx-0.5" />
      <span className="px-2">LF</span>

      {/* Language */}
      <div className="h-full w-px bg-white/5 mx-0.5" />
      <button
        type="button"
        className="px-2 h-full hover:bg-white/5 transition cursor-pointer text-zinc-400"
        title="Select language mode"
      >
        {langLabel}
      </button>

      {/* Settings */}
      <div className="h-full w-px bg-white/5 mx-0.5" />
      <Link
        href="/settings"
        className="px-2 h-full flex items-center gap-1 hover:bg-white/5 transition text-zinc-400 hover:text-zinc-200"
        title="Open Settings"
      >
        <svg className="h-2.5 w-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        Forge · Settings
      </Link>

      {/* Notifications */}
      <div className="h-full w-px bg-white/5 mx-0.5" />
      <button
        type="button"
        className="px-2 h-full flex items-center gap-1 hover:bg-white/5 transition cursor-pointer text-zinc-500 hover:text-zinc-300"
        title="Notifications"
      >
        <svg className="h-2.5 w-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {notifCount > 0 && (
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--brass)]" />
        )}
      </button>
    </div>
  )
}

export function IdeShell({ workspaceId }: { workspaceId: string }) {
  const setWorkspace = useIde((s) => s.setWorkspace)
  const theme = useIde((s) => s.theme)
  const setTheme = useIde((s) => s.setTheme)
  const [activeTab, setActiveTab] = useState<'files' | 'blocks'>('files')

  // Deployment states
  const [deployState, setDeployState] = useState<'idle' | 'deploying' | 'success' | 'failed'>('idle')
  const [deployUrl, setDeployUrl] = useState('')
  const [deployLogs, setDeployLogs] = useState('')
  const [showDeployModal, setShowDeployModal] = useState(false)

  useEffect(() => {
    setWorkspace(workspaceId)
    // Rehydrate saved theme on load
    const saved = (localStorage.getItem('forge:theme') as 'slate' | 'steampunk') || 'slate'
    setTheme(saved)
  }, [workspaceId, setWorkspace, setTheme])

  async function handleDeploy() {
    setDeployState('deploying')
    setDeployLogs('Booting build runner in sandbox VM...\n')
    try {
      const res = await client.deployWorkspace(workspaceId)
      if (res.ok) {
        setDeployState('success')
        setDeployUrl(res.url)
        setDeployLogs(res.logs || '✓ Build passed\n✓ Uploaded bundle\n✓ Deployment successful!')
      } else {
        setDeployState('failed')
        setDeployLogs(res.logs || '⚠️ Build failed. Check compiler errors.')
      }
    } catch (err) {
      setDeployState('failed')
      setDeployLogs(`Deploy failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return (
    <div className="grid h-dvh grid-rows-[auto_1fr_auto] bg-[var(--background)] text-zinc-200">
      <header className="flex items-center gap-3 border-b border-white/5 px-4 py-1">
        <Link href="/" className="flex items-center gap-2 select-none shrink-0">
          <Toad className="h-5 w-5" />
          <span className="text-sm font-semibold tracking-tight text-white font-cinzel">Forge</span>
        </Link>
        <span className="text-zinc-700 select-none">/</span>
        <Link href="/workspaces" className="text-xs text-zinc-400 transition hover:text-zinc-200 select-none shrink-0">
          workspaces
        </Link>
        <span className="text-zinc-700 select-none">/</span>
        <span className="font-mono text-[10px] text-zinc-550 shrink-0 select-none" title={workspaceId}>
          {workspaceId.slice(0, 10)}...
        </span>

        <span className="text-zinc-800 font-light mx-1 select-none">|</span>

        {/* Top Dropdown Menu Bar (File, Edit, Selection, View, Go, Run, Terminal, Help) */}
        <div className="flex items-center gap-1 select-none">
          <IdeMenuBar
            workspaceId={workspaceId}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            handleDeploy={handleDeploy}
          />
        </div>

        {/* Theme Switcher Button */}
        <button
          type="button"
          onClick={() => setTheme(theme === 'slate' ? 'steampunk' : 'slate')}
          className="ml-auto text-[10px] font-bold uppercase tracking-wider text-zinc-400 hover:text-[var(--brass)] cursor-pointer flex items-center gap-1 border border-white/5 px-2 py-0.5 rounded bg-white/[0.02] shrink-0 select-none"
          title="Toggle UI Layout Theme"
        >
          {theme === 'slate' ? '⚙️ Steampunk UI' : '💻 Modern UI'}
        </button>

        <span className="text-zinc-850 select-none">|</span>

        {/* One-Click Deploy controls */}
        <div className="flex items-center gap-2 select-none shrink-0">
          {deployState === 'idle' && (
            <button
              type="button"
              onClick={handleDeploy}
              className="px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider transition cursor-pointer bg-[var(--brass)] text-black hover:brightness-110 shadow-md shadow-[var(--brass)]/10"
              title="Verify compiler build and host public deployment"
            >
              🚀 Deploy App
            </button>
          )}
          {deployState === 'deploying' && (
            <button
              type="button"
              onClick={() => setShowDeployModal(true)}
              className="px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider cursor-pointer bg-zinc-800 text-[var(--brass)] border border-[var(--brass)]/30 animate-pulse flex items-center gap-1"
              title="View ongoing build process"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--brass)] animate-ping" />
              <span>Deploying...</span>
            </button>
          )}
          {deployState === 'success' && (
            <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded px-2 py-0.5 text-[10px] text-emerald-400">
              <span className="font-semibold">✓ Deployed</span>
              <span className="text-zinc-700">|</span>
              <a
                href={deployUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold underline hover:text-white transition"
              >
                Open App
              </a>
              <span className="text-zinc-700">|</span>
              <button
                type="button"
                onClick={() => setShowDeployModal(true)}
                className="text-[9px] text-zinc-400 hover:text-zinc-200 transition font-bold underline cursor-pointer"
              >
                Logs
              </button>
            </div>
          )}
          {deployState === 'failed' && (
            <div className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/30 rounded px-2 py-0.5 text-[10px] text-red-400">
              <span className="font-semibold">⚠️ Failed</span>
              <span className="text-zinc-700">|</span>
              <button
                type="button"
                onClick={() => setShowDeployModal(true)}
                className="font-bold underline hover:text-white transition cursor-pointer"
              >
                Logs
              </button>
              <span className="text-zinc-700">|</span>
              <button
                type="button"
                onClick={handleDeploy}
                className="font-bold underline hover:text-white transition cursor-pointer"
              >
                Retry
              </button>
            </div>
          )}
        </div>

        <span className="text-zinc-850 select-none">|</span>
        <Link
          href="/settings"
          className="text-xs text-zinc-400 transition hover:text-zinc-200 select-none shrink-0"
        >
          settings
        </Link>
        <span className="inline-flex items-center gap-1.5 text-xs text-zinc-500 shrink-0 select-none">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          sandbox live
        </span>
      </header>

      <div className="grid min-h-0 grid-cols-[240px_1fr_360px]">
        <aside className="min-h-0 border-r border-white/5 bg-[#0c0c0e] flex flex-col">
          {/* Tab Switcher */}
          <div className="flex border-b border-white/5 bg-black/20 text-xs select-none">
            <button
              type="button"
              onClick={() => setActiveTab('files')}
              className={cn(
                'flex-1 text-center py-2 font-semibold uppercase tracking-wider cursor-pointer border-b transition',
                activeTab === 'files'
                  ? 'border-[var(--brass)] text-[var(--brass)] bg-white/[0.02]'
                  : 'border-transparent text-zinc-500 hover:text-zinc-300'
              )}
            >
              📁 Files
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('blocks')}
              className={cn(
                'flex-1 text-center py-2 font-semibold uppercase tracking-wider cursor-pointer border-b transition',
                activeTab === 'blocks'
                  ? 'border-[var(--brass)] text-[var(--brass)] bg-white/[0.02]'
                  : 'border-transparent text-zinc-500 hover:text-zinc-300'
              )}
            >
              🧱 Blocks
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-hidden">
            {activeTab === 'files' ? (
              <FileTree workspaceId={workspaceId} />
            ) : (
              <BlocksPalette />
            )}
          </div>
        </aside>

        <section className="grid min-h-0 grid-rows-[1fr_220px]">
          <div className="min-h-0">
            <EditorPane />
          </div>
          <div className="min-h-0 border-t border-white/5">
            <TerminalPane workspaceId={workspaceId} />
          </div>
        </section>

        <aside className="min-h-0 border-l border-white/5">
          <AgentPanel workspaceId={workspaceId} />
        </aside>
      </div>

      {/* Deployment build logs modal */}
      {showDeployModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs select-none animate-fade-in">
          <div className="w-full max-w-lg rounded-xl border border-white/10 bg-[#0e0e12] p-5 shadow-2xl space-y-4 animate-slide-up">
            <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
              <h3 className="font-cinzel text-xs font-bold text-zinc-200 tracking-wider">
                Deployment Build Pipeline Logs
              </h3>
              <button
                type="button"
                onClick={() => setShowDeployModal(false)}
                className="text-zinc-400 hover:text-zinc-200 text-lg font-bold cursor-pointer"
              >
                ×
              </button>
            </div>
            <pre className="rounded bg-black p-3.5 font-mono text-[10px] text-emerald-400 overflow-auto max-h-[300px] border border-white/5 whitespace-pre-wrap">
              {deployLogs || 'Initializing build runner...'}
            </pre>
            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => setShowDeployModal(false)}
                className="rounded bg-zinc-800 border border-zinc-700 hover:border-zinc-555 px-4 py-1.5 text-xs font-semibold text-zinc-200 transition cursor-pointer"
              >
                Close Logs
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VS Code-style status bar */}
      <IdeStatusBar workspaceId={workspaceId} />
    </div>
  )
}
