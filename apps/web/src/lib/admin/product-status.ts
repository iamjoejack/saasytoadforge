import { createClient } from '@supabase/supabase-js'

/**
 * Forge launch status, shown on the marketing site. Persisted in Supabase Storage (no new
 * tables, no migration) when configured, with an in-memory fallback for local dev. Owners
 * set it from the back office; the marketing site reads it through the public GET route.
 */
export type ProductStatus = 'coming-soon' | 'early-access' | 'live'

export const PRODUCT_STATUSES: ProductStatus[] = ['coming-soon', 'early-access', 'live']
export const DEFAULT_STATUS: ProductStatus = 'coming-soon'

const BUCKET = 'forge-config'
const OBJECT = 'product-status.json'

let memoryStatus: ProductStatus = DEFAULT_STATUS

export function isValidStatus(s: unknown): s is ProductStatus {
  return typeof s === 'string' && (PRODUCT_STATUSES as string[]).includes(s)
}

function serviceClient() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

export async function getProductStatus(): Promise<ProductStatus> {
  const sb = serviceClient()
  if (!sb) return memoryStatus
  try {
    const { data, error } = await sb.storage.from(BUCKET).download(OBJECT)
    if (error || !data) return memoryStatus
    const parsed = JSON.parse(await data.text()) as { status?: unknown }
    return isValidStatus(parsed.status) ? parsed.status : DEFAULT_STATUS
  } catch {
    return memoryStatus
  }
}

export async function setProductStatus(status: ProductStatus): Promise<void> {
  memoryStatus = status
  const sb = serviceClient()
  if (!sb) return
  try {
    // Create the (private) bucket on first write; ignore "already exists".
    await sb.storage.createBucket(BUCKET, { public: false }).catch(() => undefined)
    const body = JSON.stringify({ status, updatedAt: new Date().toISOString() })
    const { error } = await sb.storage
      .from(BUCKET)
      .upload(OBJECT, body, { upsert: true, contentType: 'application/json' })
    if (error) console.error('setProductStatus write failed:', error.message)
  } catch (e) {
    console.error('setProductStatus write failed:', e instanceof Error ? e.message : String(e))
  }
}
