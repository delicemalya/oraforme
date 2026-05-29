import { NextResponse } from 'next/server'
import { relancesFactures } from '@/agents/securite'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const result = await relancesFactures()
    return NextResponse.json(result)
  } catch (err) {
    console.error('[agent/comptable/relances]', err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
