import { NextResponse } from 'next/server'
import { backupQuotidien } from '@/agents/securite'
import { requireAutomationSecret } from '@/lib/api/require-automation'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  const denied = requireAutomationSecret(req)
  if (denied) return denied

  try {
    const result = await backupQuotidien()
    return NextResponse.json(result)
  } catch (err) {
    console.error('[agent/securite/backup]', err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
