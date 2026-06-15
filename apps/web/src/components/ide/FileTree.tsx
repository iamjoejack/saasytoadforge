'use client'

import { useEffect, useState, useRef } from 'react'
import type { FileEntry } from '@forge/shared'
import * as client from '@/lib/forge-client'
import { useIde } from '@/lib/store'
import { useAgent } from '@/lib/agent-store'
import { cn } from '@/lib/cn'

function FileIcon({ type, open }: { type: 'file' | 'dir'; open: boolean }) {
  return (
    <span className="w-4 shrink-0 text-center text-zinc-500" aria-hidden>
      {type === 'dir' ? (open ? '▾' : '▸') : '·'}
    </span>
  )
}

function TreeNode({
  workspaceId,
  entry,
  depth,
}: {
  workspaceId: string
  entry: FileEntry
  depth: number
}) {
  const [open, setOpen] = useState(false)
  const [children, setChildren] = useState<FileEntry[] | null>(null)
  const openFile = useIde((s) => s.openFile)
  const activePath = useIde((s) => s.activePath)
  const dirty = useIde((s) => s.dirty)
  const fileVersion = useAgent((s) => s.fileVersion)
  const [deleting, setDeleting] = useState(false)

  async function toggle() {
    if (entry.type === 'file') {
      await openFile(entry.path)
      return
    }
    if (!open && children === null) {
      setChildren(await client.listFiles(workspaceId, entry.path))
    }
    setOpen((o) => !o)
  }

  // Reload child folders reactively on global file edits/creations/deletions
  useEffect(() => {
    if (open) {
      client.listFiles(workspaceId, entry.path)
        .then(setChildren)
        .catch(() => {})
    }
  }, [workspaceId, entry.path, open, fileVersion])

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation()
    const confirmed = window.confirm(`Are you sure you want to delete ${entry.name}?`)
    if (!confirmed) return
    setDeleting(true)
    try {
      await client.deleteFile(workspaceId, entry.path)
      useAgent.setState((s) => ({ fileVersion: s.fileVersion + 1 }))
    } catch (err) {
      alert(`Failed to delete: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setDeleting(false)
    }
  }

  const isActive = activePath === entry.path

  return (
    <div>
      <div
        style={{ paddingLeft: depth * 12 + 8 }}
        className={cn(
          'group flex w-full items-center justify-between gap-1.5 py-0.5 pr-2 text-left text-[13px] transition hover:bg-white/5',
          isActive ? 'bg-[var(--brass)]/15 text-[var(--brass)]' : 'text-zinc-350',
        )}
      >
        <button
          type="button"
          onClick={() => void toggle()}
          className="flex flex-1 items-center gap-1.5 truncate py-1 text-left cursor-pointer"
        >
          <FileIcon type={entry.type} open={open} />
          <span className="truncate">{entry.name}</span>
          {entry.type === 'file' && dirty[entry.path] ? (
            <span className="ml-2 h-1.5 w-1.5 rounded-full bg-[var(--brass)]" aria-label="unsaved" />
          ) : null}
        </button>
        
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          className="opacity-0 group-hover:opacity-100 hover:text-red-400 p-0.5 text-xs text-zinc-500 transition shrink-0 cursor-pointer disabled:opacity-30"
          title="Delete Path"
        >
          🗑️
        </button>
      </div>

      {entry.type === 'dir' && open && children
        ? children.map((child) => (
            <TreeNode key={child.path} workspaceId={workspaceId} entry={child} depth={depth + 1} />
          ))
        : null}
    </div>
  )
}

export function FileTree({ workspaceId }: { workspaceId: string }) {
  const [root, setRoot] = useState<FileEntry[] | null>(null)
  const [error, setError] = useState(false)
  const fileVersion = useAgent((s) => s.fileVersion)
  
  // File addition fields
  const [showInput, setShowInput] = useState(false)
  const [inputType, setInputType] = useState<'file' | 'folder'>('file')
  const [newItemName, setNewItemName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let active = true
    client
      .listFiles(workspaceId, '')
      .then((entries) => active && setRoot(entries))
      .catch(() => active && setError(true))
    return () => {
      active = false
    }
  }, [workspaceId, fileVersion])

  useEffect(() => {
    if (showInput) {
      inputRef.current?.focus()
    }
  }, [showInput])

  function handleAddFile() {
    setInputType('file')
    setShowInput(true)
  }

  function handleAddFolder() {
    setInputType('folder')
    setShowInput(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const path = newItemName.trim()
    if (!path) return
    
    try {
      if (inputType === 'file') {
        await client.writeFile(workspaceId, path, '')
      } else {
        // Run mkdir -p on E2B or write .gitkeep in mock
        if (workspaceId.startsWith('mock_')) {
          await client.writeFile(workspaceId, `${path}/.gitkeep`, '')
        } else {
          await client.exec(workspaceId, `mkdir -p "${path}"`)
          await client.writeFile(workspaceId, `${path}/.gitkeep`, '')
        }
      }
      useAgent.setState((s) => ({ fileVersion: s.fileVersion + 1 }))
      setNewItemName('')
      setShowInput(false)
    } catch (err) {
      alert(`Failed to create path: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* File Tree Header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/5 bg-black/10">
        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Files</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleAddFile}
            className="rounded p-1 text-[11px] text-zinc-400 hover:text-[var(--brass)] hover:bg-white/5 transition cursor-pointer"
            title="New File"
          >
            📄+
          </button>
          <button
            type="button"
            onClick={handleAddFolder}
            className="rounded p-1 text-[11px] text-zinc-400 hover:text-[var(--brass)] hover:bg-white/5 transition cursor-pointer"
            title="New Folder"
          >
            📁+
          </button>
        </div>
      </div>

      {/* Creation form */}
      {showInput && (
        <form onSubmit={handleSubmit} className="px-3 py-1.5 border-b border-white/5 flex gap-1 bg-black/30">
          <input
            ref={inputRef}
            type="text"
            placeholder={inputType === 'file' ? 'path/file.txt' : 'path/folder'}
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            className="flex-1 rounded bg-black border border-white/10 px-2 py-0.5 text-xs text-zinc-300 focus:border-[var(--brass)]/50 focus:outline-none"
          />
          <button type="submit" className="text-xs text-[var(--brass)] px-1 hover:underline cursor-pointer font-medium">Create</button>
          <button type="button" onClick={() => setShowInput(false)} className="text-xs text-zinc-500 px-1 hover:underline cursor-pointer">Cancel</button>
        </form>
      )}

      {/* Root files list */}
      <div className="min-h-0 flex-1 overflow-auto pb-2">
        {error ? (
          <p className="px-3 py-2 text-xs text-zinc-500">
            Could not reach the sandbox. Is the agent service running?
          </p>
        ) : root === null ? (
          <p className="px-3 py-2 text-xs text-zinc-500 animate-pulse">Loading...</p>
        ) : (
          root.map((entry) => (
            <TreeNode key={entry.path} workspaceId={workspaceId} entry={entry} depth={0} />
          ))
        )}
      </div>
    </div>
  )
}
