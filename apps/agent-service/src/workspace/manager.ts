import type { SandboxProvider } from '@forge/shared'

export interface Workspace {
  id: string
  sandboxId: string
  createdAt: string
}

/** Files seeded into every new workspace so the IDE opens onto something real. */
const STARTER_FILES: Readonly<Record<string, string>> = {
  'README.md':
    '# New Forge workspace\n\nDescribe a task in the agent panel and Forge will plan, edit, and verify it here.\n',
  'index.js': "console.log('hello from forge')\n",
  'src/app.js': "export function greet(name) {\n  return `hi ${name}`\n}\n",
}

/**
 * Owns the live sandboxes behind each workspace. In-memory for Phase 1; persistence
 * (Supabase) lands in Phase 5. Workspace id == sandbox id for now.
 */
export class WorkspaceManager {
  private readonly workspaces = new Map<string, Workspace>()

  constructor(private readonly provider: SandboxProvider) {}

  async create(): Promise<Workspace> {
    const sandbox = await this.provider.create({ template: 'node', envAllowlist: [] })
    for (const [path, contents] of Object.entries(STARTER_FILES)) {
      await this.provider.writeFile(sandbox.id, path, contents)
    }
    const workspace: Workspace = {
      id: sandbox.id,
      sandboxId: sandbox.id,
      createdAt: sandbox.createdAt,
    }
    this.workspaces.set(workspace.id, workspace)
    return workspace
  }

  get(id: string): Workspace | undefined {
    return this.workspaces.get(id)
  }

  list(): Workspace[] {
    return [...this.workspaces.values()]
  }

  async destroy(id: string): Promise<boolean> {
    const workspace = this.workspaces.get(id)
    if (!workspace) return false
    await this.provider.destroy(workspace.sandboxId)
    this.workspaces.delete(id)
    return true
  }
}
