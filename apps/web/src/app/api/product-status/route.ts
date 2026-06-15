import { NextResponse } from 'next/server'
import { currentAdmin } from '@/lib/admin/server'
import { getProductStatus, setProductStatus, isValidStatus } from '@/lib/admin/product-status'

/** Public: the marketing site reads the launch status here. */
export async function GET() {
  const status = await getProductStatus()
  return NextResponse.json({ status }, { headers: { 'cache-control': 'public, max-age=60' } })
}

/** Owner, or an admin with the "content" area, can set the launch status. */
export async function POST(req: Request) {
  const admin = await currentAdmin()
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (admin.role !== 'owner' && !admin.permissions.includes('content')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  const body = (await req.json().catch(() => ({}))) as { status?: unknown }
  if (!isValidStatus(body.status)) {
    return NextResponse.json({ error: 'invalid status' }, { status: 400 })
  }
  await setProductStatus(body.status)
  return NextResponse.json({ ok: true, status: body.status })
}
