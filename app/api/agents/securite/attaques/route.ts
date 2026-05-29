import { NextResponse } from 'next/server'
import { detecterAttaques } from '@/agents/securite'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const result = await detecterAttaques()
    return NextResponse.json(result)
  } catch (err) {
    console.error('[agent/securite/attaques]', err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
