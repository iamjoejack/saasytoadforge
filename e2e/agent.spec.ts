import { test, expect } from '@playwright/test'

/**
 * Phase 2 gate through the real Agent panel: the canonical task produces a plan,
 * file edits (diff artifacts), and a passing test run (terminal artifact).
 * The execution is simulated by the mock sandbox; the same flow runs for real on E2B.
 */
test('agent loop: plan, edits, and a green test run as artifacts', async ({ page }) => {
  await page.goto('/workspaces')
  await page.getByRole('button', { name: 'New workspace' }).click()
  await page.waitForURL(/\/workspaces\/.+/)

  await expect(page.getByText('Ronald', { exact: true })).toBeVisible()
  // Agent websocket connected.
  await expect(page.getByText('ready')).toBeVisible({ timeout: 10000 })

  await page
    .getByPlaceholder('Describe a task')
    .fill('add an endpoint that returns the current time and a test for it')
  await page.getByRole('button', { name: 'Send' }).click()

  // Plan artifact.
  await expect(page.getByText('Plan', { exact: true })).toBeVisible({ timeout: 10000 })
  await expect(page.getByText('Add a current-time endpoint', { exact: true })).toBeVisible()

  // Diff artifact (a real edit applied to the sandbox).
  await expect(page.getByText('export function currentTime').first()).toBeVisible({ timeout: 10000 })

  // Terminal artifact: the test run went green.
  await expect(page.getByText('exit 0')).toBeVisible({ timeout: 10000 })
  await expect(page.getByText('pass 1')).toBeVisible()

  await page.screenshot({ path: 'test-results/agent.png' })
})
