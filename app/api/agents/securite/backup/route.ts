import { NextResponse } from 'next/server'
import { backupQuotidien } from '@/agents/securite'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const result = await backupQuotidien()
    return NextResponse.json(result)
  } catch (err) {
    console.error('[agent/securite/backup]', err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
