import { test, expect } from '@playwright/test'
import { authenticate } from './helpers'

test.beforeEach(async ({ page }) => {
  await authenticate(page)
})

/**
 * Phase 3 gate: a multi-file task touching UI. The orchestrator decomposes it across
 * subagents (coder/verifier/browser) and the artifact bundle includes a plan, a
 * multi-file diff, test output, and a screenshot.
 */
test('multi-file UI task: subagents produce plan, multi-file diff, test, screenshot', async ({
  page,
}) => {
  await page.goto('/workspaces')
  await page.getByRole('button', { name: 'New workspace' }).click()
  await page.waitForURL(/\/workspaces\/.+/)
  await expect(page.getByText('ready')).toBeVisible({ timeout: 10000 })

  await page
    .getByPlaceholder('Describe a task')
    .fill('build a greeting page with a button and a test')
  await page.getByRole('button', { name: 'Send' }).click()

  // Plan with subagent roles.
  await expect(page.getByText('Plan', { exact: true })).toBeVisible({ timeout: 10000 })
  await expect(page.getByText('coder').first()).toBeVisible()
  await expect(page.getByText('browser').first()).toBeVisible()

  // Multi-file diff (three files, asserted by distinct content).
  await expect(page.getByText('Hello from Forge').first()).toBeVisible({ timeout: 10000 })
  await expect(page.getByText('export function greet').first()).toBeVisible()
  await expect(page.getByText('greet builds a greeting').first()).toBeVisible()

  // Verifier test run went green.
  await expect(page.getByText('exit 0')).toBeVisible({ timeout: 15000 })

  // Browser subagent screenshot artifact.
  await expect(page.getByText('Greeting page').first()).toBeVisible({ timeout: 15000 })
  await expect(page.locator('img[alt="Greeting page"]')).toBeVisible({ timeout: 15000 })

  // Accept/reject controls on diffs.
  await expect(page.getByRole('button', { name: 'Accept' }).first()).toBeVisible()

  await page.screenshot({ path: 'test-results/subagents.png', fullPage: true })
})
