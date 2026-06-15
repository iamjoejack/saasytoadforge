'use client'

import dynamic from 'next/dynamic'
import { useEffect, useRef, useState } from 'react'
import { useIde, type CodeEditor } from '@/lib/store'
import { languageFor } from '@/lib/language'
import { Toad } from '@/components/Toad'
import { cn } from '@/lib/cn'

const Monaco = dynamic(() => import('@monaco-editor/react'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full flex-col bg-[#0d0d0f] p-4 font-mono text-[13px] text-zinc-700 select-none animate-pulse">
      <div className="flex gap-4 mb-2">
        <span className="w-8 shrink-0 select-none text-right opacity-30">1</span>
        <div className="h-4 w-[35%] rounded bg-white/5" />
      </div>
      <div className="flex gap-4 mb-2">
        <span className="w-8 shrink-0 select-none text-right opacity-30">2</span>
        <div className="h-4 w-[55%] rounded bg-white/5" />
      </div>
      <div className="flex gap-4 mb-2">
        <span className="w-8 shrink-0 select-none text-right opacity-30">3</span>
        <div className="h-4 w-[20%] rounded bg-white/5" />
      </div>
      <div className="flex gap-4 mb-2">
        <span className="w-8 shrink-0 select-none text-right opacity-30">4</span>
        <div className="h-4 w-[70%] rounded bg-white/5" />
      </div>
      <div className="flex gap-4 mb-2">
        <span className="w-8 shrink-0 select-none text-right opacity-30">5</span>
        <div className="h-4 w-[45%] rounded bg-white/5" />
      </div>
    </div>
  ),
})

const SAVE_DEBOUNCE_MS = 600

export function EditorPane() {
  const openTabs = useIde((s) => s.openTabs)
  const activePath = useIde((s) => s.activePath)
  const contents = useIde((s) => s.contents)
  const dirty = useIde((s) => s.dirty)
  const setActive = useIde((s) => s.setActive)
  const closeTab = useIde((s) => s.closeTab)
  const edit = useIde((s) => s.edit)
  const save = useIde((s) => s.save)
  const workspaceId = useIde((s) => s.workspaceId)
  const openFile = useIde((s) => s.openFile)
  const setEditorInstance = useIde((s) => s.setEditorInstance)

  const viewMode = useIde((s) => s.viewMode)
  const setViewMode = useIde((s) => s.setViewMode)
  const [browserUrl, setBrowserUrl] = useState('http://localhost:3000')
  const [inputUrl, setInputUrl] = useState('http://localhost:3000')
  const [iframeKey, setIframeKey] = useState(0)
  
  // Inspect Mode State
  const [inspectMode, setInspectMode] = useState(false)

  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  useEffect(() => {
    if (workspaceId) {
      if (workspaceId.startsWith('mock_')) {
        setBrowserUrl('http://localhost:3000')
        setInputUrl('http://localhost:3000')
      } else {
        const url = `https://3000-${workspaceId}.e2b.dev`
        setBrowserUrl(url)
        setInputUrl(url)
      }
    }
  }, [workspaceId])

  useEffect(() => {
    const pending = timers.current
    return () => {
      for (const timer of Object.values(pending)) clearTimeout(timer)
      setEditorInstance(null)
    }
  }, [setEditorInstance])

  // Click-to-Edit message listener from real iframe proxy
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.data && event.data.type === 'inspect-element') {
        const { path, line } = event.data
        if (typeof path === 'string') {
          void openFile(path).then(() => {
            setViewMode('editor')
            setInspectMode(false)
            setTimeout(() => {
              const editor = useIde.getState().editorInstance
              if (editor && typeof line === 'number') {
                editor.revealLine(line)
                editor.setPosition({ lineNumber: line, column: 1 })
                editor.focus()
              }
            }, 100)
          })
        }
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [openFile])

  function scheduleSave(path: string) {
    clearTimeout(timers.current[path])
    timers.current[path] = setTimeout(() => void save(path), SAVE_DEBOUNCE_MS)
  }

  function handleGo(e: React.FormEvent) {
    e.preventDefault()
    let target = inputUrl.trim()
    if (target && !/^https?:\/\//i.test(target)) {
      target = `http://${target}`
    }
    setBrowserUrl(target)
    setInputUrl(target)
  }

  function handleRefresh() {
    setIframeKey((k) => k + 1)
  }

  // Click-to-Edit Navigation for simulated mock components
  function handleSimulatedInspect(path: string, line: number) {
    if (!inspectMode) return
    setInspectMode(false)
    void openFile(path).then(() => {
      setViewMode('editor')
      setTimeout(() => {
        const editor = useIde.getState().editorInstance
        if (editor) {
          editor.revealLine(line)
          editor.setPosition({ lineNumber: line, column: 1 })
          editor.focus()
        }
      }, 100)
    })
  }

  return (
    <div className="flex h-full flex-col bg-[#0d0d0f]">
      <div className="flex items-center justify-between border-b border-white/5 bg-[#0a0a0b] px-2 min-h-[36px]">
        {/* Left: Open file tabs list */}
        <div className="flex items-stretch overflow-x-auto">
          {openTabs.map((path) => {
            const name = path.split('/').pop() ?? path
            const isActive = path === activePath && viewMode === 'editor'
            return (
              <div
                key={path}
                className={cn(
                  'group flex items-center gap-2 border-r border-white/5 px-3 py-1.5 text-[13px] transition-colors',
                  isActive ? 'bg-[#0d0d0f] text-zinc-100' : 'text-zinc-400 hover:text-zinc-200',
                )}
              >
                <button
                  type="button"
                  onClick={() => {
                    setActive(path)
                    setViewMode('editor')
                  }}
                  className="flex items-center gap-1.5 cursor-pointer font-medium"
                >
                  {dirty[path] ? <span className="h-1.5 w-1.5 rounded-full bg-[var(--brass)]" /> : null}
                  {name}
                </button>
                <button
                  type="button"
                  aria-label={`Close ${name}`}
                  onClick={() => closeTab(path)}
                  className="text-zinc-500 transition hover:text-zinc-355 ml-1 cursor-pointer"
                >
                  ×
                </button>
              </div>
            )
          })}
        </div>

        {/* Right: View mode switcher */}
        <div className="flex items-center gap-1.5 py-1">
          <button
            type="button"
            onClick={() => setViewMode('editor')}
            className={cn(
              'px-2.5 py-1 rounded text-xs font-semibold uppercase tracking-wider transition cursor-pointer flex items-center gap-1',
              viewMode === 'editor'
                ? 'bg-zinc-800 text-[var(--brass)] border border-[var(--brass)]/30'
                : 'text-zinc-500 hover:text-zinc-350'
            )}
          >
            Code
          </button>
          <button
            type="button"
            onClick={() => setViewMode('browser')}
            className={cn(
              'px-2.5 py-1 rounded text-xs font-semibold uppercase tracking-wider transition cursor-pointer flex items-center gap-1',
              viewMode === 'browser'
                ? 'bg-zinc-800 text-[var(--brass)] border border-[var(--brass)]/30'
                : 'text-zinc-500 hover:text-zinc-350'
            )}
          >
            Live preview
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 relative">
        {viewMode === 'editor' ? (
          openTabs.length === 0 || !activePath ? (
            <div className="flex h-full items-center justify-center bg-[#0d0d0f] text-sm text-zinc-650">
              Select a file to start editing.
            </div>
          ) : (
            <Monaco
              height="100%"
              theme="vs-dark"
              path={activePath}
              language={languageFor(activePath)}
              value={contents[activePath] ?? ''}
              onChange={(value) => {
                edit(activePath, value ?? '')
                scheduleSave(activePath)
              }}
              onMount={(editor) => setEditorInstance(editor as unknown as CodeEditor)}
              options={{
                minimap: { enabled: false },
                fontSize: 13,
                fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
                automaticLayout: true,
                scrollBeyondLastLine: false,
                padding: { top: 12 },
              }}
            />
          )
        ) : (
          /* Live Browser Simulator Panel */
          <div className="flex h-full flex-col bg-[#0b0b0d]">
            {/* Address Bar */}
            <div className="flex items-center gap-2 border-b border-white/5 bg-[#101013] px-3 py-2">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled
                  className="rounded p-1 text-zinc-600 cursor-not-allowed hover:bg-white/5 transition"
                  title="Back (disabled)"
                >
                  ←
                </button>
                <button
                  type="button"
                  disabled
                  className="rounded p-1 text-zinc-600 cursor-not-allowed hover:bg-white/5 transition"
                  title="Forward (disabled)"
                >
                  →
                </button>
                <button
                  type="button"
                  onClick={handleRefresh}
                  className="rounded p-1 text-zinc-400 hover:text-[var(--brass)] hover:bg-white/5 transition cursor-pointer"
                  title="Reload"
                >
                  ↻
                </button>
              </div>

              <form onSubmit={handleGo} className="flex flex-1 items-center gap-2">
                <input
                  type="text"
                  value={inputUrl}
                  onChange={(e) => setInputUrl(e.target.value)}
                  className="w-full rounded bg-black/40 border border-white/10 px-3 py-1 text-xs font-mono text-zinc-300 placeholder:text-zinc-650 focus:border-[var(--brass)]/50 focus:outline-none"
                  placeholder="Enter URL (e.g. http://localhost:3000)"
                />
              </form>

              <div className="flex items-center gap-2.5 px-1 shrink-0">
                {/* Visual Inspector cursor toggle button */}
                <button
                  type="button"
                  onClick={() => setInspectMode(!inspectMode)}
                  className={cn(
                    'px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider transition cursor-pointer flex items-center gap-1 border',
                    inspectMode
                      ? 'bg-[var(--brass)]/20 text-[var(--brass)] border-[var(--brass)]/50 animate-pulse'
                      : 'text-zinc-400 border-white/10 hover:text-zinc-200'
                  )}
                  title="Inspect visual component (click component to go to code)"
                >
                  Inspect
                </button>

                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                  Live Proxy
                </span>
              </div>
            </div>

            {/* Browser frame container */}
            <div className="min-h-0 flex-1 relative bg-zinc-950">
              {browserUrl.includes('localhost') && workspaceId?.startsWith('mock_') ? (
                <div className="flex h-full flex-col items-center justify-center p-8 text-center bg-[#0e0e12] overflow-auto select-none">
                  <div className="circuit-grid opacity-20" />
                  
                  <div className="relative z-10 max-w-md p-6 rounded-xl border border-[var(--brass)]/25 bg-black/40 space-y-4 shadow-xl">
                    <div className="flex justify-center">
                      <div
                        onClick={() => handleSimulatedInspect('src/components/Toad.tsx', 2)}
                        className={cn(
                          'h-12 w-12 rounded-full bg-[var(--brass)]/10 border border-[var(--brass)]/30 flex items-center justify-center text-2xl animate-bounce transition-all',
                          inspectMode && 'border-dashed border-[var(--brass)] bg-[var(--brass)]/20 hover:scale-110 cursor-crosshair'
                        )}
                        title={inspectMode ? 'Inspect src/components/Toad.tsx' : undefined}
                      >
                        <Toad className="h-7 w-7" />
                      </div>
                    </div>
                    
                    <div
                      onClick={() => handleSimulatedInspect('src/App.tsx', 15)}
                      className={cn(
                        'space-y-1 p-2 rounded transition-all',
                        inspectMode && 'border border-dashed border-[var(--brass)] bg-[var(--brass)]/5 hover:bg-[var(--brass)]/10 cursor-crosshair'
                      )}
                      title={inspectMode ? 'Inspect src/App.tsx' : undefined}
                    >
                      <h3 className="font-cinzel text-md font-bold text-white tracking-wide">
                        SaaSyToad Local App Simulator
                      </h3>
                      <p className="text-[11px] text-[var(--brass)] font-semibold tracking-wider uppercase">
                        Mock Sandbox Port 3000 Active
                      </p>
                    </div>

                    <p className="text-xs text-zinc-400 leading-relaxed">
                      Forge is executing your repository environment inside an isolated sandbox VM. 
                      Since this is a simulated sandbox, the server output is mocked below. 
                      To run a live web server on actual hardware VMs, connect to a production E2B template.
                    </p>

                    <div className="border-t border-white/5 pt-3 text-left space-y-2">
                      <span className="text-[9px] uppercase font-bold text-zinc-500 tracking-wider block">
                        Simulated Console Logs
                      </span>
                      <div
                        onClick={() => handleSimulatedInspect('src/components/Console.tsx', 5)}
                        className={cn(
                          'rounded bg-black/80 p-2.5 font-mono text-[10px] text-emerald-400 space-y-1.5 border border-white/5 transition-all',
                          inspectMode && 'border-dashed border-[var(--brass)] bg-emerald-500/10 hover:brightness-110 cursor-crosshair'
                        )}
                        title={inspectMode ? 'Inspect src/components/Console.tsx' : undefined}
                      >
                        <p className="text-zinc-500">[{new Date().toLocaleTimeString()}] Starting bundler...</p>
                        <p className="text-zinc-500">[{new Date().toLocaleTimeString()}] Loaded environment configs</p>
                        <p className="text-emerald-500">✓ Ready in 450ms. Local: http://localhost:3000</p>
                        <p className="text-emerald-400">✓ Supabase database connection verified.</p>
                      </div>
                    </div>

                    <div className="text-[10px] text-zinc-500">
                      {inspectMode ? (
                        <span className="text-[var(--brass)] font-bold animate-pulse">
                          Inspect mode active: click any highlighted container or element to locate its code file.
                        </span>
                      ) : (
                        <span>Press <strong>↻</strong> reload above to restart the simulated process loop.</span>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-full w-full relative">
                  {inspectMode && (
                    <div className="absolute inset-0 bg-[var(--brass)]/5 pointer-events-none border-2 border-dashed border-[var(--brass)]/30 z-40 flex items-center justify-center">
                      <span className="bg-black/80 text-[var(--brass)] border border-[var(--brass)]/30 px-3 py-1.5 rounded text-xs font-bold font-mono shadow-lg animate-pulse">
                        Inspecting sandbox live elements (click component to edit)
                      </span>
                    </div>
                  )}
                  <iframe
                    key={iframeKey}
                    src={browserUrl}
                    className="h-full w-full border-none bg-white"
                    sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
