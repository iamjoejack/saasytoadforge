import { test, expect } from '@playwright/test'
import { authenticate } from './helpers'

test.beforeEach(async ({ page }) => {
  await authenticate(page)
})

/**
 * Phase 1 gate, end to end through the real UI:
 * open a workspace -> sandbox boots -> edit a file (persists) -> run a shell
 * command -> output streams back. Captures a screenshot artifact.
 */
test('IDE round-trip: create workspace, open a file, run a shell command', async ({ page }) => {
  const agentBase = 'http://localhost:8787'
  await page.goto('/workspaces')

  await page.getByRole('button', { name: 'New workspace' }).click()
  await page.waitForURL(/\/workspaces\/.+/)
  const workspaceId = page.url().split('/workspaces/')[1] ?? ''
  expect(workspaceId).toMatch(/^mock_/)

  // Landed in the 3-pane IDE.
  await expect(page.getByText('Files')).toBeVisible()
  await expect(page.getByText('Terminal')).toBeVisible()
  await expect(page.getByText('Ronald', { exact: true })).toBeVisible()

  // File tree loaded from the live sandbox.
  const readme = page.getByRole('button', { name: /README\.md/ })
  await expect(readme).toBeVisible({ timeout: 15000 })
  await readme.click()

  // Monaco mounted with the file open.
  await expect(page.locator('.monaco-editor').first()).toBeVisible({ timeout: 25000 })

  // Edit in Monaco; the debounced save must persist to the sandbox.
  await page.locator('.monaco-editor').first().click()
  await page.keyboard.press('ControlOrMeta+End')
  await page.keyboard.type('\nedited by e2e')
  await expect(async () => {
    const res = await page.request.get(
      `${agentBase}/workspaces/${workspaceId}/file?path=README.md`,
    )
    const body = (await res.json()) as { contents: string }
    expect(body.contents).toContain('edited by e2e')
    expect(body.contents).toContain('New Forge workspace')
  }).toPass({ timeout: 6000 })

  // Run a command in the terminal; the streamed output comes back.
  await page.locator('.xterm-helper-textarea').click()
  await page.keyboard.type('echo forge-e2e-ok')
  await page.keyboard.press('Enter')
  await expect(page.locator('.xterm-rows')).toContainText('forge-e2e-ok', { timeout: 10000 })

  await page.screenshot({ path: 'test-results/ide.png' })
})
