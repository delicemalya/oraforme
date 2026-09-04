import { NextResponse } from 'next/server'
import { detecterAttaques } from '@/agents/securite'
import { requireAutomationSecret } from '@/lib/api/require-automation'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  const denied = requireAutomationSecret(req)
  if (denied) return denied

  try {
    const result = await detecterAttaques()
    return NextResponse.json(result)
  } catch (err) {
    console.error('[agent/securite/attaques]', err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
