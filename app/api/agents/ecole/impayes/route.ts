import { NextResponse } from 'next/server'
import { verifierImpayes } from '@/agents/securite'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const result = await verifierImpayes()
    return NextResponse.json(result)
  } catch (err) {
    console.error('[agent/ecole/impayes]', err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
