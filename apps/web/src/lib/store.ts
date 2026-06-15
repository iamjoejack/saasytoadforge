import { create } from 'zustand'
import * as client from './forge-client'

interface IdeStore {
  workspaceId: string | null
  activePath: string | null
  openTabs: string[]
  contents: Record<string, string>
  dirty: Record<string, boolean>
  saving: Record<string, boolean>

  setWorkspace: (id: string) => void
  openFile: (path: string) => Promise<void>
  setActive: (path: string) => void
  closeTab: (path: string) => void
  edit: (path: string, value: string) => void
  save: (path: string) => Promise<void>
}

/**
 * IDE state: which files are open, their in-memory contents, and dirty/saving flags.
 * The sandbox file system is the source of truth; this caches what the editor shows
 * and pushes writes back through the agent-service.
 */
export const useIde = create<IdeStore>()((set, get) => ({
  workspaceId: null,
  activePath: null,
  openTabs: [],
  contents: {},
  dirty: {},
  saving: {},

  setWorkspace: (id) => set({ workspaceId: id }),

  openFile: async (path) => {
    const { workspaceId, contents } = get()
    if (!workspaceId) return
    if (contents[path] === undefined) {
      const text = await client.readFile(workspaceId, path)
      set((s) => ({ contents: { ...s.contents, [path]: text } }))
    }
    set((s) => ({
      activePath: path,
      openTabs: s.openTabs.includes(path) ? s.openTabs : [...s.openTabs, path],
    }))
  },

  setActive: (path) => set({ activePath: path }),

  closeTab: (path) =>
    set((s) => {
      const openTabs = s.openTabs.filter((p) => p !== path)
      const activePath =
        s.activePath === path ? (openTabs[openTabs.length - 1] ?? null) : s.activePath
      return { openTabs, activePath }
    }),

  edit: (path, value) =>
    set((s) => ({
      contents: { ...s.contents, [path]: value },
      dirty: { ...s.dirty, [path]: true },
    })),

  save: async (path) => {
    const { workspaceId, contents } = get()
    if (!workspaceId) return
    const value = contents[path]
    if (value === undefined) return
    set((s) => ({ saving: { ...s.saving, [path]: true } }))
    try {
      await client.writeFile(workspaceId, path, value)
      set((s) => ({
        dirty: { ...s.dirty, [path]: false },
        saving: { ...s.saving, [path]: false },
      }))
    } catch (err) {
      set((s) => ({ saving: { ...s.saving, [path]: false } }))
      throw err
    }
  },
}))
