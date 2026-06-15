import type { Page } from '@playwright/test'

let counter = 0

/** Sign up a fresh user so the session cookie is set on the browser context. */
export async function authenticate(page: Page): Promise<string> {
  counter += 1
  const email = `e2e-${Date.now()}-${counter}-${Math.floor(Math.random() * 1e6)}@forge.dev`
  const res = await page.request.post('/api/auth/signup', {
    data: { email, password: 'password123' },
  })
  if (!res.ok()) throw new Error(`auth setup failed: ${res.status()}`)
  return email
}
