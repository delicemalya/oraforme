import { NextResponse } from 'next/server'
import { rapportSuperviseur } from '@/agents/securite'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const result = await rapportSuperviseur()
    return NextResponse.json(result)
  } catch (err) {
    console.error('[agent/superviseur/rapport]', err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
