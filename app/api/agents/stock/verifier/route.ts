import { NextResponse } from 'next/server'
import { verifierStockRuptures } from '@/agents/securite'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const result = await verifierStockRuptures()
    return NextResponse.json(result)
  } catch (err) {
    console.error('[agent/stock/verifier]', err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
