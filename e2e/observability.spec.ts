import { test, expect } from '@playwright/test'
import { authenticate } from './helpers'

test.beforeEach(async ({ page }) => {
  await authenticate(page)
})

/** Phase 4: the Settings screen shows the enforced policy, and per-session cost is visible. */
test('settings shows policy and the agent panel shows per-session cost', async ({ page }) => {
  await page.goto('/settings')
  await expect(page.getByText('Model routing')).toBeVisible({ timeout: 10000 })
  await expect(page.getByText('openrouter/fusion')).toBeVisible() // deep tier
  await expect(page.getByText('Spend caps (internal cost control)')).toBeVisible()
  await expect(page.getByText('Egress allowlist (default-deny)')).toBeVisible()

  // Run a task; per-session cost appears once the run completes.
  await page.goto('/workspaces')
  await page.getByRole('button', { name: 'New workspace' }).click()
  await page.waitForURL(/\/workspaces\/.+/)
  await expect(page.getByText('ready')).toBeVisible({ timeout: 10000 })

  await page
    .getByPlaceholder('Describe a task')
    .fill('add a current time endpoint and a test for it')
  await page.getByRole('button', { name: 'Send' }).click()
  await expect(page.getByText('exit 0')).toBeVisible({ timeout: 15000 })
  await expect(page.getByText(/this session/)).toBeVisible({ timeout: 10000 })

  await page.screenshot({ path: 'test-results/observability.png', fullPage: true })
})
