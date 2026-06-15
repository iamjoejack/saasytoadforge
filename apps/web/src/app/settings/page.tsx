'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { ConfigSummary } from '@forge/shared'
import { isOwnerEmailDefault } from '@forge/shared'
import * as client from '@/lib/forge-client'
import { Toad } from '@/components/Toad'
import { useAgent } from '@/lib/agent-store'
import { useIde } from '@/lib/store'
import { cn } from '@/lib/cn'

export default function SettingsPage() {
  const router = useRouter()
  const [config, setConfig] = useState<ConfigSummary | null>(null)
  const [error, setError] = useState(false)
  const [user, setUser] = useState<{ id: string; email: string } | null>(null)

  // Spend & Top-Up Limits state (persisted to localStorage)
  const [unlimitedMode, setUnlimitedMode] = useState(false)
  const [softLimitUsd, setSoftLimitUsd] = useState('10.00')
  const [blockSizeUsd, setBlockSizeUsd] = useState('5')
  const [showSafety, setShowSafety] = useState(false)
  const [savedMsg, setSavedMsg] = useState('')

  // API Keys state
  const [anthropicKey, setAnthropicKey] = useState('')
  const [googleKey, setGoogleKey] = useState('')
  const [customKeysSaved, setCustomKeysSaved] = useState('')

  // Notifications state
  const [notificationsEnabled, setNotificationsEnabled] = useState(false)

  // Danger zone state
  const [deletingAll, setDeletingAll] = useState(false)

  // Active Tab state
  const [activeTab, setActiveTab] = useState<'account' | 'keys' | 'spend' | 'appearance' | 'danger'>('account')

  // Theme store
  const currentTheme = useIde((s) => s.theme)
  const setTheme = useIde((s) => s.setTheme)

  // Agent store custom model overrides
  const customModelId = useAgent((s) => s.customModelId)
  const setCustomModelId = useAgent((s) => s.setCustomModelId)
  const socket = useAgent((s) => s.socket)
  const interviewEnabled = useAgent((s) => s.interviewEnabled)
  const setInterviewEnabled = useAgent((s) => s.setInterviewEnabled)

  // Fetch session & config on mount
  useEffect(() => {
    client
      .getConfig()
      .then(setConfig)
      .catch(() => setError(true))

    fetch('/api/auth/session')
      .then((res) => res.json())
      .then((data: { user?: { id: string; email: string } | null }) => {
        if (data.user) setUser(data.user)
      })
      .catch(() => {})

    // Load custom developer keys from localStorage
    try {
      const keysSaved = localStorage.getItem('forge:custom_keys')
      if (keysSaved) {
        const parsed = JSON.parse(keysSaved)
        if (parsed.anthropic) setAnthropicKey(parsed.anthropic)
        if (parsed.google) setGoogleKey(parsed.google)
      }
    } catch {
      // ignore malformed or unavailable local storage
    }

    // Load notification settings
    try {
      const isNotifOn = localStorage.getItem('forge:notifications') === 'true'
      setNotificationsEnabled(isNotifOn && Notification.permission === 'granted')
    } catch {
      // ignore unavailable notification API / storage
    }
  }, [])

  // Load spend prefs on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('forge:spend_prefs')
      if (saved) {
        const p = JSON.parse(saved) as { unlimitedMode?: boolean; softLimitUsd?: string; blockSizeUsd?: string }
        if (p.unlimitedMode !== undefined) setUnlimitedMode(p.unlimitedMode)
        if (p.softLimitUsd) setSoftLimitUsd(p.softLimitUsd)
        if (p.blockSizeUsd) setBlockSizeUsd(p.blockSizeUsd)
      }
    } catch {
      // ignore malformed or unavailable local storage
    }
  }, [])

  function saveSpendPrefs(newUnlimited: boolean, newSoft: string, newBlock: string) {
    try {
      localStorage.setItem('forge:spend_prefs', JSON.stringify({
        unlimitedMode: newUnlimited,
        softLimitUsd: newSoft,
        blockSizeUsd: newBlock,
      }))
    } catch {
      // ignore storage failures (private mode, quota)
    }

    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'spend_topup_mode', enabled: newUnlimited }))
    }
    setSavedMsg('✓ Spend settings saved')
    setTimeout(() => setSavedMsg(''), 2500)
  }

  function handleToggleUnlimited(enabled: boolean) {
    if (enabled && !showSafety) {
      setShowSafety(true)
      return
    }
    setUnlimitedMode(enabled)
    setShowSafety(false)
    saveSpendPrefs(enabled, softLimitUsd, blockSizeUsd)
  }

  function saveCustomKeys() {
    try {
      localStorage.setItem('forge:custom_keys', JSON.stringify({
        anthropic: anthropicKey.trim() || undefined,
        google: googleKey.trim() || undefined,
      }))
      setCustomKeysSaved('✓ API Keys updated locally')
      setTimeout(() => setCustomKeysSaved(''), 2500)
    } catch {
      setCustomKeysSaved('Failed to save keys')
    }
  }

  async function handleToggleNotifications(enabled: boolean) {
    if (enabled) {
      if (!('Notification' in window)) {
        alert('This browser does not support desktop notifications.')
        return
      }
      const permission = await Notification.requestPermission()
      if (permission === 'granted') {
        localStorage.setItem('forge:notifications', 'true')
        setNotificationsEnabled(true)
      } else {
        localStorage.setItem('forge:notifications', 'false')
        setNotificationsEnabled(false)
        alert('Permission for notifications was denied.')
      }
    } else {
      localStorage.setItem('forge:notifications', 'false')
      setNotificationsEnabled(false)
    }
  }

  async function handleSignOut() {
    await fetch('/api/auth/signout', { method: 'POST' })
    router.push('/signin')
    router.refresh()
  }

  async function handleDeleteAllWorkspaces() {
    const confirmText = 'Are you sure you want to delete ALL workspaces? This cannot be undone.'
    if (!window.confirm(confirmText)) return
    setDeletingAll(true)
    try {
      const list = await client.listWorkspaces()
      await Promise.all(list.map((ws) => client.deleteWorkspace(ws.id)))
      alert('All workspaces deleted successfully.')
      router.push('/workspaces')
    } catch (err) {
      alert(`Failed to delete workspaces: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setDeletingAll(false)
    }
  }

  const isOwner = isOwnerEmailDefault(user?.email)

  const tabs = [
    { id: 'account', label: 'Account & plan' },
    { id: 'keys', label: 'API keys & custom model' },
    { id: 'spend', label: 'Spend & caps' },
    { id: 'appearance', label: 'Theme & UX' },
    { id: 'danger', label: 'Danger zone' },
  ] as const

  return (
    <main className="mx-auto min-h-dvh max-w-5xl px-6 py-10 animate-fade-in">
      {/* Page Header */}
      <div className="mb-8 flex items-center gap-3 border-b border-white/5 pb-5">
        <Toad className="h-7 w-7" />
        <div>
          <h1 className="text-xl font-bold font-cinzel text-zinc-100 tracking-wider">Ronald Forge Settings</h1>
          <p className="text-[11px] text-zinc-500">Configure workspaces, models, caps, and appearance.</p>
        </div>
        <Link href="/workspaces" className="ml-auto text-xs text-zinc-450 border border-white/10 rounded-lg px-3 py-1.5 hover:text-zinc-200 hover:border-white/20 transition bg-black/20">
          ← Back to Workspaces
        </Link>
      </div>

      {error ? (
        <p className="text-sm text-red-400">Could not reach the agent service.</p>
      ) : !config ? (
        <p className="text-sm text-zinc-500">Loading configurations...</p>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
          {/* Left Sidebar Navigation */}
          <div className="flex flex-col gap-1.5 md:col-span-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'w-full text-left rounded-lg px-3 py-2 text-xs font-semibold tracking-wide border transition cursor-pointer',
                  activeTab === tab.id
                    ? 'bg-[var(--brass)]/10 text-[var(--brass)] border-[var(--brass)]/30 font-bold'
                    : 'bg-transparent text-zinc-400 border-transparent hover:bg-white/[0.03] hover:text-zinc-250'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Right Detailed Content */}
          <div className="md:col-span-3 rounded-xl border border-white/10 bg-white/[0.01] p-6 glass-panel relative">
            {/* Tab: Account & Plan */}
            {activeTab === 'account' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-sm font-semibold font-cinzel text-zinc-200 uppercase tracking-wider mb-1">Account &amp; Plan</h2>
                  <p className="text-[11px] text-zinc-550">Review your profile details and billing plan status.</p>
                </div>

                <div className="space-y-3.5 border-t border-white/5 pt-4">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-zinc-500">Account Email</span>
                    <span className="text-zinc-200 font-medium">{user?.email || 'Loading...'}</span>
                  </div>

                  <div className="flex justify-between items-center text-xs">
                    <span className="text-zinc-500">Active Tier / Plan</span>
                    <div>
                      {isOwner ? (
                        <span className="rounded-full bg-amber-500/10 border border-amber-500/25 px-2.5 py-0.5 text-[10px] font-bold text-amber-400 uppercase tracking-wider">
                          Company Owner (Unlimited)
                        </span>
                      ) : (
                        <span className="rounded-full bg-[var(--brass)]/15 border border-[var(--brass)]/30 px-2.5 py-0.5 text-[10px] font-bold text-[var(--brass)] uppercase tracking-wider">
                          Pro Builder ($29/mo)
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-xs">
                    <span className="text-zinc-500">Usage Limit Status</span>
                    <span className="text-zinc-200 font-mono">
                      {isOwner ? 'Unlimited token allocations & zero spend cap' : 'Subject to user soft limit caps'}
                    </span>
                  </div>
                </div>

                <div className="border-t border-white/5 pt-5 flex justify-end">
                  <button
                    type="button"
                    onClick={() => void handleSignOut()}
                    className="rounded-lg border border-red-500/20 bg-red-500/5 hover:bg-red-500/15 hover:border-red-500/30 text-red-400 px-4 py-2 text-xs font-semibold transition cursor-pointer"
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            )}

            {/* Tab: API Keys & Custom Model */}
            {activeTab === 'keys' && (
              <div className="space-y-6">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-sm font-semibold font-cinzel text-zinc-200 uppercase tracking-wider mb-1">Developer Keys &amp; Model Overrides</h2>
                    <p className="text-[11px] text-zinc-550">Provide custom developer API credentials to run tasks with your own accounts.</p>
                  </div>
                  {customKeysSaved && <span className="text-[10px] font-bold text-emerald-400">{customKeysSaved}</span>}
                </div>

                <div className="space-y-4 border-t border-white/5 pt-4">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-450">Anthropic API Key</label>
                    <input
                      type="password"
                      placeholder="sk-ant-..."
                      value={anthropicKey}
                      onChange={(e) => setAnthropicKey(e.target.value)}
                      className="w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-xs text-zinc-200 placeholder:text-zinc-700 focus:border-[var(--brass)]/50 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-450">Google Gemini API Key</label>
                    <input
                      type="password"
                      placeholder="AIzaSy..."
                      value={googleKey}
                      onChange={(e) => setGoogleKey(e.target.value)}
                      className="w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-xs text-zinc-200 placeholder:text-zinc-700 focus:border-[var(--brass)]/50 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1 pt-2 border-t border-white/5">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-450">Custom Model ID override</label>
                    <input
                      type="text"
                      placeholder="e.g. google/gemini-2.5-pro"
                      value={customModelId}
                      onChange={(e) => setCustomModelId(e.target.value)}
                      className="w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-xs text-zinc-200 placeholder:text-zinc-600 focus:border-[var(--brass)]/50 focus:outline-none font-mono"
                    />
                    <p className="text-[9px] text-zinc-550 leading-relaxed">
                      This model identifier will be sent to the agent service whenever the **"Custom Model"** option is selected in the timeline compose bar.
                    </p>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={saveCustomKeys}
                    className="rounded-lg bg-[var(--brass)] text-black hover:brightness-110 px-4 py-2 text-xs font-bold transition cursor-pointer"
                  >
                    Save Keys &amp; Overrides
                  </button>
                </div>
              </div>
            )}

            {/* Tab: Spend & Caps */}
            {activeTab === 'spend' && (
              <div className="space-y-6">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-sm font-semibold font-cinzel text-zinc-200 uppercase tracking-wider mb-1">Spend &amp; Top-Up Limits</h2>
                    <p className="text-[11px] text-zinc-550">Configure how Forge controls model execution budget limits.</p>
                  </div>
                  {savedMsg && <span className="text-[10px] font-bold text-emerald-400">{savedMsg}</span>}
                </div>

                {/* Switcher Option */}
                <div className="flex items-center justify-between rounded-lg border border-white/10 bg-black/30 px-4 py-3 border-t border-white/5">
                  <div>
                    <p className="text-xs font-semibold text-zinc-200">
                      {unlimitedMode ? 'Unlimited top-up mode' : 'Fixed credit limit'}
                    </p>
                    <p className="text-[10px] text-zinc-500 mt-0.5">
                      {unlimitedMode
                        ? 'Requests explicit confirmation before each small token credit allocation.'
                        : 'Automatically stops the agent run when the user cap limit is reached.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggleUnlimited(!unlimitedMode)}
                    className={cn(
                      'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 transition-colors duration-200 focus:outline-none',
                      unlimitedMode ? 'border-amber-500 bg-amber-500/80' : 'border-zinc-700 bg-zinc-800'
                    )}
                  >
                    <span
                      className={cn(
                        'pointer-events-none inline-block h-4 w-4 translate-y-[1px] rounded-full bg-white shadow-lg ring-0 transition-transform duration-200',
                        unlimitedMode ? 'translate-x-5' : 'translate-x-0.5'
                      )}
                    />
                  </button>
                </div>

                {showSafety && (
                  <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 space-y-3 animate-fade-in">
                    <p className="text-xs font-bold text-amber-400">Enable unlimited top-up mode?</p>
                    <p className="text-[10px] text-zinc-400 leading-relaxed">
                      In Unlimited Mode, Ronald Forge will pause execution and prompt you for approval before allocating each small credit block.
                      Every credit extension requires an explicit tap to approve.
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleToggleUnlimited(true)}
                        className="flex-1 rounded bg-amber-500 px-3 py-1.5 text-xs font-bold text-black hover:brightness-110 transition cursor-pointer"
                      >
                        Enable Unlimited Mode
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowSafety(false)}
                        className="flex-1 rounded bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-zinc-750 transition cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Config based on mode */}
                {!unlimitedMode ? (
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-450">
                      Monthly Credit Soft Limit (USD)
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-500 text-xs">$</span>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={softLimitUsd}
                        onChange={(e) => setSoftLimitUsd(e.target.value)}
                        className="w-28 rounded bg-black/40 border border-white/10 px-3 py-1.5 text-xs text-zinc-200 focus:border-[var(--brass)]/50 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => saveSpendPrefs(unlimitedMode, softLimitUsd, blockSizeUsd)}
                        className="rounded bg-[var(--brass)] px-3 py-1.5 text-xs font-bold text-black hover:brightness-110 transition cursor-pointer"
                      >
                        Save Limit
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-450">
                      Approval Block Size (USD)
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-500 text-xs">$</span>
                      <select
                        value={blockSizeUsd}
                        onChange={(e) => setBlockSizeUsd(e.target.value)}
                        className="w-28 rounded bg-black/80 border border-white/10 px-2.5 py-1.5 text-xs text-zinc-200 focus:border-[var(--brass)]/50 focus:outline-none cursor-pointer"
                      >
                        <option value="1">$1</option>
                        <option value="2">$2</option>
                        <option value="5">$5</option>
                        <option value="10">$10</option>
                        <option value="25">$25</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => saveSpendPrefs(unlimitedMode, softLimitUsd, blockSizeUsd)}
                        className="rounded bg-[var(--brass)] px-3 py-1.5 text-xs font-bold text-black hover:brightness-110 transition cursor-pointer"
                      >
                        Save Selection
                      </button>
                    </div>
                  </div>
                )}

                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2.5">
                  <p className="text-[10px] text-zinc-450 leading-relaxed">
                    <strong className="text-zinc-300">Safety Guarantee:</strong> Forge will never silently charge beyond your set limits. All credit allocations require your active approval.
                  </p>
                </div>

                <div className="border-t border-white/5 pt-4 space-y-2">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-zinc-450">Internal Cost Caps</span>
                  <div className="flex justify-between items-center text-xs text-zinc-400">
                    <span>Per User Limit Cap</span>
                    <span className="font-mono">${config.caps.perUserUsd.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs text-zinc-400">
                    <span>Global Service Spend Cap</span>
                    <span className="font-mono">${config.caps.globalUsd.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Tab: Theme & UX */}
            {activeTab === 'appearance' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-sm font-semibold font-cinzel text-zinc-200 uppercase tracking-wider mb-1">Theme &amp; Notifications</h2>
                  <p className="text-[11px] text-zinc-550">Customize appearance styles and client-side notifications preferences.</p>
                </div>

                {/* Theme options */}
                <div className="space-y-3 border-t border-white/5 pt-4">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-450">Theme Selection</label>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => setTheme('slate')}
                      className={cn(
                        'rounded-xl border p-4 text-center cursor-pointer transition',
                        currentTheme === 'slate'
                          ? 'border-[var(--brass)]/60 bg-[var(--brass)]/10 text-white'
                          : 'border-white/5 bg-black/20 text-zinc-400 hover:border-white/10 hover:text-zinc-200'
                      )}
                    >
                      <span className="block text-xs font-bold">Slate Mode</span>
                      <span className="text-[10px] text-zinc-500 mt-1 block">Minimalist Dark Indigo theme</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setTheme('steampunk')}
                      className={cn(
                        'rounded-xl border p-4 text-center cursor-pointer transition',
                        currentTheme === 'steampunk'
                          ? 'border-[var(--brass)]/60 bg-[var(--brass)]/10 text-white'
                          : 'border-white/5 bg-black/20 text-zinc-400 hover:border-white/10 hover:text-zinc-200'
                      )}
                    >
                      <span className="block text-xs font-bold font-cinzel">Steampunk Mode</span>
                      <span className="text-[10px] text-zinc-500 mt-1 block font-cinzel">Classic Toad gold &amp; gear aesthetics</span>
                    </button>
                  </div>
                </div>

                {/* Notifications toggle */}
                <div className="space-y-3 pt-4 border-t border-white/5">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-450">Desktop Notifications</label>
                      <p className="text-[10px] text-zinc-550 leading-relaxed mt-0.5">
                        Send system desktop alerts whenever background tasks complete or experience errors.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleToggleNotifications(!notificationsEnabled)}
                      className={cn(
                        'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 transition-colors duration-200 focus:outline-none',
                        notificationsEnabled ? 'border-[var(--brass)] bg-[var(--brass)]/80' : 'border-zinc-700 bg-zinc-800'
                      )}
                    >
                      <span
                        className={cn(
                          'pointer-events-none inline-block h-4 w-4 translate-y-[1px] rounded-full bg-white shadow-lg ring-0 transition-transform duration-200',
                          notificationsEnabled ? 'translate-x-5' : 'translate-x-0.5'
                        )}
                      />
                    </button>
                  </div>
                </div>

                {/* Discovery interview toggle */}
                <div className="space-y-3 pt-4 border-t border-white/5">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-450">Discovery interview</label>
                      <p className="text-[10px] text-zinc-550 leading-relaxed mt-0.5">
                        When on, Ronald asks a few quick questions to understand what you want before building. Turn it off to start building right away.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setInterviewEnabled(!interviewEnabled)}
                      className={cn(
                        'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 transition-colors duration-200 focus:outline-none',
                        interviewEnabled ? 'border-[var(--brass)] bg-[var(--brass)]/80' : 'border-zinc-700 bg-zinc-800'
                      )}
                      aria-pressed={interviewEnabled}
                    >
                      <span
                        className={cn(
                          'pointer-events-none inline-block h-4 w-4 translate-y-[1px] rounded-full bg-white shadow-lg ring-0 transition-transform duration-200',
                          interviewEnabled ? 'translate-x-5' : 'translate-x-0.5'
                        )}
                      />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Tab: Danger Zone */}
            {activeTab === 'danger' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-sm font-semibold font-cinzel text-red-400 uppercase tracking-wider mb-1">Danger Zone</h2>
                  <p className="text-[11px] text-zinc-550">Destructive actions that cannot be undone.</p>
                </div>

                <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 space-y-4 border-t border-white/5 pt-4">
                  <div className="flex justify-between items-start gap-4">
                    <div className="space-y-0.5">
                      <p className="text-xs font-bold text-red-400">Delete All Workspaces</p>
                      <p className="text-[10px] text-zinc-450 leading-relaxed">
                        This action will immediately destroy every sandboxed workspace, container directory, deployment domain, and session history logs linked to your user account.
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={deletingAll}
                      onClick={() => void handleDeleteAllWorkspaces()}
                      className="rounded-lg bg-red-650 hover:bg-red-600 text-white font-bold px-3 py-2 text-xs transition cursor-pointer disabled:opacity-40 select-none shrink-0"
                    >
                      {deletingAll ? 'Deleting…' : 'Delete All Workspaces'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  )
}
