import { NextResponse } from 'next/server'
import { rappelsBulletinsPaie } from '@/agents/securite'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const result = await rappelsBulletinsPaie()
    return NextResponse.json(result)
  } catch (err) {
    console.error('[agent/rh/bulletins]', err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
