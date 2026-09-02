import { NextResponse } from 'next/server'
import { monitorerPerformances } from '@/agents/securite'
import { requireAutomationSecret } from '@/lib/api/require-automation'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  const denied = requireAutomationSecret(req)
  if (denied) return denied

  try {
    const result = await monitorerPerformances()
    return NextResponse.json(result)
  } catch (err) {
    console.error('[agent/securite/performance]', err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
