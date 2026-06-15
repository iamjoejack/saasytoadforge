import type { FileEntry, ExecResult, ConfigSummary, SpendSummaryDto, Plan } from '@forge/shared'

export interface Workspace {
  id: string
  sandboxId: string
  createdAt: string
}

const BASE = process.env.NEXT_PUBLIC_AGENT_SERVICE_URL ?? 'http://localhost:8787'

export function agentServiceBase(): string {
  return BASE
}

/** Derive a websocket channel URL from an http(s) base. Pure for testability. */
export function toWsUrl(base: string, workspaceId: string, channel: 'shell' | 'agent' = 'shell'): string {
  return `${base.replace(/^http/, 'ws')}/workspaces/${workspaceId}/${channel}`
}

export function shellUrl(workspaceId: string): string {
  return toWsUrl(BASE, workspaceId, 'shell')
}

export function agentUrl(workspaceId: string): string {
  return toWsUrl(BASE, workspaceId, 'agent')
}

async function asJson<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`forge-client: ${res.status} ${res.statusText}`)
  return res.json() as Promise<T>
}

export async function createWorkspace(): Promise<Workspace> {
  return asJson(await fetch(`${BASE}/workspaces`, { method: 'POST' }))
}

export async function listWorkspaces(): Promise<Workspace[]> {
  return asJson(await fetch(`${BASE}/workspaces`))
}

export async function listFiles(id: string, dir = ''): Promise<FileEntry[]> {
  return asJson(await fetch(`${BASE}/workspaces/${id}/files?dir=${encodeURIComponent(dir)}`))
}

export async function readFile(id: string, path: string): Promise<string> {
  const { contents } = await asJson<{ contents: string }>(
    await fetch(`${BASE}/workspaces/${id}/file?path=${encodeURIComponent(path)}`),
  )
  return contents
}

export async function writeFile(id: string, path: string, contents: string): Promise<void> {
  await asJson(
    await fetch(`${BASE}/workspaces/${id}/file`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path, contents }),
    }),
  )
}

export async function exec(id: string, cmd: string): Promise<ExecResult> {
  return asJson(
    await fetch(`${BASE}/workspaces/${id}/exec`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ cmd }),
    }),
  )
}

export async function getConfig(): Promise<ConfigSummary> {
  return asJson(await fetch(`${BASE}/config`))
}

export async function getSpend(id: string): Promise<SpendSummaryDto> {
  return asJson(await fetch(`${BASE}/workspaces/${id}/spend`))
}

export async function getPlans(): Promise<Plan[]> {
  return asJson(await fetch(`${BASE}/billing/plans`))
}
