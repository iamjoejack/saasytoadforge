import { create } from 'zustand'
import * as client from './forge-client'

/**
 * Minimal structural view of the Monaco editor we drive from the IDE chrome.
 * Avoids pulling the full monaco type graph into the store while staying type-safe.
 */
export interface CodeEditor {
  focus(): void
  getSelection(): unknown
  executeEdits(
    source: string,
    edits: Array<{ range: unknown; text: string; forceMoveMarkers?: boolean }>,
  ): unknown
  getAction(id: string): { run(): unknown } | null
  trigger(source: string, handlerId: string, payload: unknown): void
  revealLine(line: number): void
  setPosition(position: { lineNumber: number; column: number }): void
}

/**
 * The bits of the live xterm session the IDE chrome drives. Registered by TerminalPane so
 * menu actions run against the real shell instead of reporting success they never performed.
 */
export interface TerminalHandle {
  clear(): void
  /** Types the command into the sandbox shell and presses enter. */
  runCommand(command: string): void
}

interface IdeStore {
  workspaceId: string | null
  activePath: string | null
  openTabs: string[]
  contents: Record<string, string>
  dirty: Record<string, boolean>
  saving: Record<string, boolean>
  editorInstance: CodeEditor | null
  terminal: TerminalHandle | null
  theme: 'slate' | 'steampunk'
  viewMode: 'editor' | 'browser'
  /** Bumped to ask the live preview to reload without reloading the whole IDE. */
  previewReloadNonce: number

  setWorkspace: (id: string) => void
  openFile: (path: string) => Promise<void>
  setActive: (path: string) => void
  closeTab: (path: string) => void
  edit: (path: string, value: string) => void
  save: (path: string) => Promise<void>
  setEditorInstance: (editor: CodeEditor | null) => void
  setTerminal: (terminal: TerminalHandle | null) => void
  reloadPreview: () => void
  insertSnippet: (snippet: string) => void
  setTheme: (theme: 'slate' | 'steampunk') => void
  setViewMode: (mode: 'editor' | 'browser') => void
  /** Live cursor position from Monaco editor. */
  cursorPos: { line: number; col: number }
  setCursorPos: (pos: { line: number; col: number }) => void
  /** Detected language of the active file. */
  activeLanguage: string
  setActiveLanguage: (lang: string) => void
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
  editorInstance: null,
  terminal: null,
  theme: 'steampunk',
  viewMode: 'editor',
  previewReloadNonce: 0,
  cursorPos: { line: 1, col: 1 },
  activeLanguage: 'plaintext',

  setCursorPos: (pos) => set({ cursorPos: pos }),
  setActiveLanguage: (lang) => set({ activeLanguage: lang }),

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

  setEditorInstance: (editor) => set({ editorInstance: editor }),

  setTerminal: (terminal) => set({ terminal }),

  reloadPreview: () =>
    set((s) => ({ viewMode: 'browser', previewReloadNonce: s.previewReloadNonce + 1 })),

  insertSnippet: (snippet) => {
    const editor = get().editorInstance
    if (editor) {
      const selection = editor.getSelection()
      if (selection) {
        editor.executeEdits('insertSnippet', [
          {
            range: selection,
            text: snippet,
            forceMoveMarkers: true,
          },
        ])
      }
    }
  },

  setTheme: (theme) => {
    try {
      localStorage.setItem('forge:theme', theme)
    } catch {
      // ignore
    }
    if (typeof document !== 'undefined') {
      document.body.classList.toggle('theme-steampunk', theme === 'steampunk')
      document.body.classList.toggle('theme-slate', theme === 'slate')
    }
    set({ theme })
  },

  setViewMode: (viewMode) => set({ viewMode }),
}))
