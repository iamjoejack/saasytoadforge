import { test, expect } from '@playwright/test'
import { authenticate } from './helpers'

test.beforeEach(async ({ page }) => {
  await authenticate(page)
})

/** Write-approval gate: each file write pauses until the user approves it. */
test('write-approval gate pauses writes and resumes on approve', async ({ page }) => {
  await page.goto('/workspaces')
  await page.getByRole('button', { name: 'New workspace' }).click()
  await page.waitForURL(/\/workspaces\/.+/)
  await expect(page.getByText('ready')).toBeVisible({ timeout: 10000 })

  await page.getByLabel('approve writes').check()
  await page
    .getByPlaceholder('Describe a task')
    .fill('add a current time endpoint and a test for it')
  await page.getByRole('button', { name: 'Send' }).click()

  // First write pauses for approval.
  await expect(page.getByText('Approval needed:').first()).toBeVisible({ timeout: 10000 })

  // Approve each write as it appears, until the test run completes.
  for (let i = 0; i < 6; i++) {
    if (await page.getByText('exit 0').isVisible().catch(() => false)) break
    const approve = page.getByRole('button', { name: 'Approve' }).first()
    if (await approve.isVisible().catch(() => false)) await approve.click()
    await page.waitForTimeout(400)
  }

  await expect(page.getByText('exit 0')).toBeVisible({ timeout: 10000 })
  await expect(page.getByText('Approved').first()).toBeVisible()
  await page.screenshot({ path: 'test-results/approval.png' })
})
