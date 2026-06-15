import { test, expect } from '@playwright/test'

/** Phase 5 (dev auth): the app is gated; a user can sign up, create a workspace, sign out. */
test('auth gate: redirect, sign up, create workspace, sign out', async ({ page }) => {
  // Unauthenticated -> redirected to sign in.
  await page.goto('/workspaces')
  await expect(page).toHaveURL(/\/signin/)
  await expect(page.getByPlaceholder('you@example.com')).toBeVisible()
  await page.screenshot({ path: 'test-results/signin.png' })

  // Sign up with a fresh account.
  await page.getByRole('button', { name: 'New here? Create an account' }).click()
  const email = `e2e-ui-${Date.now()}@forge.dev`
  await page.getByPlaceholder('you@example.com').fill(email)
  await page.getByPlaceholder('password (8+ characters)').fill('password123')
  await page.getByRole('button', { name: 'Sign up' }).click()

  // Landed on workspaces, signed in.
  await expect(page).toHaveURL(/\/workspaces$/)
  await expect(page.getByText(`signed in as ${email}`)).toBeVisible({ timeout: 10000 })

  // Create a workspace -> IDE.
  await page.getByRole('button', { name: 'New workspace' }).click()
  await page.waitForURL(/\/workspaces\/.+/)
  await expect(page.getByText('Files')).toBeVisible()

  // Sign out -> back to the gate.
  await page.goto('/workspaces')
  await page.getByRole('button', { name: 'sign out' }).click()
  await expect(page).toHaveURL(/\/signin/)
})
