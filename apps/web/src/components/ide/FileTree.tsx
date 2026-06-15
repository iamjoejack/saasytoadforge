'use client'

import { useEffect, useState } from 'react'
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

  const isActive = activePath === entry.path

  return (
    <div>
      <button
        type="button"
        onClick={() => void toggle()}
        style={{ paddingLeft: depth * 12 + 8 }}
        className={cn(
          'flex w-full items-center gap-1.5 py-1 pr-2 text-left text-[13px] transition',
          isActive ? 'bg-[var(--brass)]/15 text-[var(--brass)]' : 'text-zinc-300 hover:bg-white/5',
        )}
      >
        <FileIcon type={entry.type} open={open} />
        <span className="truncate">{entry.name}</span>
        {entry.type === 'file' && dirty[entry.path] ? (
          <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[var(--brass)]" aria-label="unsaved" />
        ) : null}
      </button>
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
  // Re-fetch the root listing whenever the agent edits a file.
  const fileVersion = useAgent((s) => s.fileVersion)

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

  return (
    <div className="flex h-full flex-col">
      <div className="px-3 py-2 text-[11px] font-medium uppercase tracking-wider text-zinc-500">
        Files
      </div>
      <div className="min-h-0 flex-1 overflow-auto pb-2">
        {error ? (
          <p className="px-3 py-2 text-xs text-zinc-500">
            Could not reach the sandbox. Is the agent service running?
          </p>
        ) : root === null ? (
          <p className="px-3 py-2 text-xs text-zinc-500">Loading...</p>
        ) : (
          root.map((entry) => (
            <TreeNode key={entry.path} workspaceId={workspaceId} entry={entry} depth={0} />
          ))
        )}
      </div>
    </div>
  )
}
