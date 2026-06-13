/**
 * POST /api/whatsapp/send
 * Envoie un message WhatsApp Business via Meta Cloud API.
 * Le token d'accès est lu depuis whatsapp_config (jamais exposé au client).
 *
 * Body JSON :
 * {
 *   type: 'invoice' | 'quote' | 'payroll' | 'reminder' | 'recruitment' | 'fiscal' | 'custom',
 *   ...opts  (champs selon le type, voir lib/whatsapp-business.ts)
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/api/require-tenant'
import { createWhatsappService } from '@/lib/whatsapp-business'
import type {
  SendInvoiceOpts,
  SendQuoteOpts,
  SendPayrollOpts,
  SendReminderOpts,
  SendRecruitmentAlertOpts,
  SendFiscalAlertOpts,
} from '@/lib/whatsapp-business'

export async function POST(req: NextRequest) {
  const ctx = await requireTenant(req)
  if (!ctx.ok) return ctx.error
  const tenantId = ctx.tid

  const body = await req.json() as { type: string } & Record<string, unknown>
  const wa = createWhatsappService(tenantId)

  let result
  switch (body.type) {
    case 'invoice':
      result = await wa.sendInvoice(body as unknown as SendInvoiceOpts)
      break
    case 'quote':
      result = await wa.sendQuote(body as unknown as SendQuoteOpts)
      break
    case 'payroll':
      result = await wa.sendPayroll(body as unknown as SendPayrollOpts)
      break
    case 'reminder':
      result = await wa.sendReminder(body as unknown as SendReminderOpts)
      break
    case 'recruitment':
      result = await wa.sendRecruitmentAlert(body as unknown as SendRecruitmentAlertOpts)
      break
    case 'fiscal':
      result = await wa.sendFiscalAlert(body as unknown as SendFiscalAlertOpts)
      break
    default:
      return NextResponse.json({ error: `Type inconnu : ${body.type}` }, { status: 400 })
  }

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 422 })
  return NextResponse.json({ ok: true, whatsapp_id: result.whatsapp_id })
}
