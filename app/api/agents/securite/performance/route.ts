import { NextResponse } from 'next/server'
import { monitorerPerformances } from '@/agents/securite'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const result = await monitorerPerformances()
    return NextResponse.json(result)
  } catch (err) {
    console.error('[agent/securite/performance]', err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
