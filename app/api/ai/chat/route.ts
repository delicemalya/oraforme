import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getMIAASystemPrompt } from '@/lib/miaa-prompt'
import { requireTenant } from '@/lib/api/require-tenant'
import { supabaseAdmin } from '@/lib/supabase-server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    // Auth + tenant isolation — modules NEVER trusted from client
    const ctx = await requireTenant(req)
    if (!ctx.ok) return ctx.error

    const body = await req.json() as {
      message: string
      entreprise?: string
      module?: string
      user_role?: string
      history?: { role: 'user' | 'assistant'; content: string }[]
    }

    const { message, entreprise, module: mod, user_role, history } = body

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { reply: "⚠️ Clé ANTHROPIC_API_KEY non configurée dans .env.local. Ajoutez-la pour activer MIAA+." },
        { status: 200 }
      )
    }

    // Load actual modules from DB — client-provided list is ignored (security)
    const { data: moduleRows } = await supabaseAdmin
      .from('tenant_modules')
      .select('module_key')
      .eq('tenant_id', ctx.tid)
      .eq('enabled', true)

    const modules_actifs = (moduleRows ?? []).map(r => r.module_key)

    const systemPrompt = getMIAASystemPrompt({
      module:          mod            ?? 'dashboard',
      entreprise:      entreprise     ?? 'PME africaine',
      modules_actifs,
      user_role:       user_role      ?? 'gestionnaire',
    })

    // Build conversation history (max last 10 exchanges = 20 messages)
    const historyMessages: Anthropic.MessageParam[] = (history ?? [])
      .slice(-20)
      .map(m => ({ role: m.role, content: m.content }))

    const response = await anthropic.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system:     systemPrompt,
      messages:   [...historyMessages, { role: 'user', content: message }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    return NextResponse.json({ reply: text, module: mod ?? 'dashboard' })
  } catch (err) {
    console.error('[MIAA+ /api/ai/chat]', err)
    return NextResponse.json({ reply: "❌ Erreur lors de la connexion à MIAA+. Vérifiez votre clé API." })
  }
}
