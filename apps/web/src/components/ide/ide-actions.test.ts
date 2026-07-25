import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'

/**
 * The IDE chrome must never report work it did not do. "Run unit tests" and "Clear console"
 * each used to pop an alert() announcing success while running nothing, and "Reload preview"
 * called window.location.reload(), which throws away open tabs, unsaved buffers, and the
 * agent socket. These assertions are structural because the behavior lives in menu wiring.
 */
const shell = readFileSync(join(__dirname, 'IdeShell.tsx'), 'utf8')
const terminalPane = readFileSync(join(__dirname, 'TerminalPane.tsx'), 'utf8')

describe('IDE menu actions run against the real session', () => {
  it('runs tests through the terminal handle, not an alert', () => {
    expect(shell).toMatch(/terminal\?\.runCommand\(/)
    expect(shell).not.toMatch(/alert\([^)]*test suite/i)
  })

  it('clears the console through the terminal handle, not an alert', () => {
    expect(shell).toMatch(/terminal\?\.clear\(\)/)
    expect(shell).not.toMatch(/alert\([^)]*console reset/i)
  })

  it('disables both terminal actions until a shell is connected', () => {
    expect(shell).toMatch(/handleRunTests,\s*disabled:\s*!terminal/)
    expect(shell).toMatch(/handleClearConsole,\s*disabled:\s*!terminal/)
  })

  it('reloads only the preview, never the whole window', () => {
    expect(shell).toMatch(/reloadPreview\(\)/)
    expect(shell).not.toMatch(/window\.location\.reload/)
  })

  it('registers a terminal handle and tears it down on unmount', () => {
    expect(terminalPane).toMatch(/setTerminal\(\{/)
    expect(terminalPane).toMatch(/setTerminal\(null\)/)
  })

  it('refuses to run a command when the shell socket is closed', () => {
    // A closed socket must surface in the terminal rather than silently swallowing the run.
    expect(terminalPane).toMatch(/readyState !== WebSocket\.OPEN/)
    expect(terminalPane).toMatch(/could not run/)
  })
})

describe('the extension catalog states real setup, not an invented CLI', () => {
  const dashboard = readFileSync(join(__dirname, '../../app/dashboard/page.tsx'), 'utf8')

  it('no longer prints a fabricated stripe projects command', () => {
    // There is no Forge CLI; every card previously offered "stripe projects add <name>".
    expect(dashboard).not.toMatch(/stripe projects add/)
  })

  it('shows the env vars the agent service actually reads', () => {
    expect(dashboard).toMatch(/envVars: 'E2B_API_KEY'/)
    expect(dashboard).toMatch(/envVars: 'STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET'/)
  })
})
