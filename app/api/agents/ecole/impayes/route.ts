import { NextResponse } from 'next/server'
import { verifierImpayes } from '@/agents/securite'
import { requireAutomationSecret } from '@/lib/api/require-automation'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  const denied = requireAutomationSecret(req)
  if (denied) return denied

  try {
    const result = await verifierImpayes()
    return NextResponse.json(result)
  } catch (err) {
    console.error('[agent/ecole/impayes]', err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
