'use client'

import dynamic from 'next/dynamic'
import { useRef } from 'react'
import { useIde } from '@/lib/store'
import { languageFor } from '@/lib/language'
import { cn } from '@/lib/cn'

const Monaco = dynamic(() => import('@monaco-editor/react'), {
  ssr: false,
  loading: () => <div className="p-4 text-sm text-zinc-500">Loading editor...</div>,
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

  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  function scheduleSave(path: string) {
    clearTimeout(timers.current[path])
    timers.current[path] = setTimeout(() => void save(path), SAVE_DEBOUNCE_MS)
  }

  if (openTabs.length === 0 || !activePath) {
    return (
      <div className="flex h-full items-center justify-center bg-[#0d0d0f] text-sm text-zinc-600">
        Select a file to start editing.
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col bg-[#0d0d0f]">
      <div className="flex items-stretch overflow-x-auto border-b border-white/5 bg-[#0a0a0b]">
        {openTabs.map((path) => {
          const name = path.split('/').pop() ?? path
          const isActive = path === activePath
          return (
            <div
              key={path}
              className={cn(
                'group flex items-center gap-2 border-r border-white/5 px-3 py-1.5 text-[13px]',
                isActive ? 'bg-[#0d0d0f] text-zinc-100' : 'text-zinc-400 hover:text-zinc-200',
              )}
            >
              <button type="button" onClick={() => setActive(path)} className="flex items-center gap-1.5">
                {dirty[path] ? <span className="h-1.5 w-1.5 rounded-full bg-[var(--brass)]" /> : null}
                {name}
              </button>
              <button
                type="button"
                aria-label={`Close ${name}`}
                onClick={() => closeTab(path)}
                className="text-zinc-600 transition hover:text-zinc-300"
              >
                ×
              </button>
            </div>
          )
        })}
      </div>
      <div className="min-h-0 flex-1">
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
          options={{
            minimap: { enabled: false },
            fontSize: 13,
            fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
            automaticLayout: true,
            scrollBeyondLastLine: false,
            padding: { top: 12 },
          }}
        />
      </div>
    </div>
  )
}
