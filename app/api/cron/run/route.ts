import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { processPendingExecutions, fireTrigger } from '@/lib/workflow/engine'
import { processPendingWebhooks } from '@/lib/webhooks/sender'

export const dynamic = 'force-dynamic'

// POST /api/cron/run — called by Vercel Cron or external scheduler
// Header: Authorization: Bearer <CRON_SECRET>
export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization') ?? ''
  const secret = process.env.CRON_SECRET ?? ''

  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results: Record<string, number> = {}

  // 1. Process pending workflow executions
  results.workflow_executions = await processPendingExecutions()

  // 2. Fire scheduled triggers for all active tenants
  const now = new Date()
  const hh = now.getUTCHours()
  const mm = now.getUTCMinutes()
  const dow = now.getUTCDay() // 0=Sun
  const dom = now.getUTCDate()

  // Only fire scheduled triggers at the right time window
  // Cron is called every minute; filters to exact intervals
  if (mm === 0) { // top of every hour — daily at 06:00 UTC
    if (hh === 6) await fireScheduled('scheduled.daily', results)
  }
  if (mm === 0 && hh === 7 && dow === 1) { // Monday 07:00 UTC
    await fireScheduled('scheduled.weekly', results)
  }
  if (mm === 0 && hh === 7 && dom === 1) { // 1st of month 07:00 UTC
    await fireScheduled('scheduled.monthly', results)
  }

  // 3. Process pending webhooks / retries
  results.webhook_deliveries = await processPendingWebhooks()

  // 4. Process pending email queue via Resend
  results.emails_processed = await processEmailQueue()

  // 5. Process pending SMS queue
  results.sms_processed = await processSmsQueue()

  // 6. Alert: contracts expiring in 30 days
  results.contract_alerts = await checkContractExpiry()

  // 7. Alert: invoices overdue
  results.invoice_alerts = await checkInvoiceOverdue()

  return NextResponse.json({
    ok: true,
    timestamp: now.toISOString(),
    results,
  })
}

// GET /api/cron/run — Vercel Cron uses GET
export async function GET(req: NextRequest) {
  return POST(req)
}

// ── Scheduled trigger dispatcher ──────────────────────────────────────────────

async function fireScheduled(
  type: 'scheduled.daily' | 'scheduled.weekly' | 'scheduled.monthly',
  results: Record<string, number>,
): Promise<void> {
  const { data: tenants } = await supabaseAdmin
    .from('tenants')
    .select('id')
    .eq('is_active', true)

  let count = 0
  for (const t of tenants ?? []) {
    await fireTrigger({
      type,
      tenant_id: t.id,
      data: { scheduled_at: new Date().toISOString() },
      timestamp: new Date().toISOString(),
    })
    count++
  }
  results[type] = count
}

// ── Email queue processor ─────────────────────────────────────────────────────

async function processEmailQueue(): Promise<number> {
  const { data: emails } = await supabaseAdmin
    .from('email_queue')
    .select('*')
    .eq('statut', 'pending')
    .order('created_at', { ascending: true })
    .limit(50)

  if (!emails?.length) return 0

  const RESEND_API_KEY = process.env.RESEND_API_KEY
  if (!RESEND_API_KEY) return 0

  let sent = 0
  for (const email of emails) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM ?? 'noreply@oraforme.com',
          to: [email.to_email],
          subject: email.subject,
          html: email.html_body ?? `<p>${email.subject}</p>`,
        }),
      })

      await supabaseAdmin
        .from('email_queue')
        .update({
          statut: res.ok ? 'sent' : 'failed',
          sent_at: res.ok ? new Date().toISOString() : null,
          error: res.ok ? null : `HTTP ${res.status}`,
          attempts: (email.attempts ?? 0) + 1,
        })
        .eq('id', email.id)

      if (res.ok) sent++
    } catch {
      await supabaseAdmin
        .from('email_queue')
        .update({ statut: 'failed', attempts: (email.attempts ?? 0) + 1 })
        .eq('id', email.id)
    }
  }
  return sent
}

// ── SMS queue processor ───────────────────────────────────────────────────────

async function processSmsQueue(): Promise<number> {
  const { data: messages } = await supabaseAdmin
    .from('sms_queue')
    .select('*')
    .eq('statut', 'pending')
    .order('created_at', { ascending: true })
    .limit(50)

  if (!messages?.length) return 0

  const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID
  const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN
  const TWILIO_FROM = process.env.TWILIO_FROM_NUMBER

  if (!TWILIO_SID || !TWILIO_TOKEN || !TWILIO_FROM) return 0

  let sent = 0
  const auth = Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64')

  for (const sms of messages) {
    try {
      const body = new URLSearchParams({
        To: sms.to_phone,
        From: TWILIO_FROM,
        Body: sms.message,
      })

      const res = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`,
        {
          method: 'POST',
          headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
          body,
        },
      )

      await supabaseAdmin
        .from('sms_queue')
        .update({
          statut: res.ok ? 'sent' : 'failed',
          sent_at: res.ok ? new Date().toISOString() : null,
          error: res.ok ? null : `HTTP ${res.status}`,
        })
        .eq('id', sms.id)

      if (res.ok) sent++
    } catch {
      await supabaseAdmin
        .from('sms_queue')
        .update({ statut: 'failed' })
        .eq('id', sms.id)
    }
  }
  return sent
}

// ── Contract expiry check ─────────────────────────────────────────────────────

async function checkContractExpiry(): Promise<number> {
  const soon = new Date(Date.now() + 30 * 86400_000).toISOString().split('T')[0]
  const today = new Date().toISOString().split('T')[0]

  const { data: contracts } = await supabaseAdmin
    .from('contracts')
    .select('id, tenant_id, employee_id, date_fin, type')
    .gte('date_fin', today)
    .lte('date_fin', soon)
    .eq('statut', 'actif')

  if (!contracts?.length) return 0

  for (const c of contracts) {
    const daysRemaining = Math.ceil(
      (new Date(c.date_fin).getTime() - Date.now()) / 86400_000,
    )
    await fireTrigger({
      type: 'contract.expiring',
      tenant_id: c.tenant_id,
      data: {
        contract: { id: c.id, type: c.type, date_fin: c.date_fin, days_remaining: daysRemaining },
        employee: { id: c.employee_id },
      },
      timestamp: new Date().toISOString(),
    })
  }
  return contracts.length
}

// ── Invoice overdue check ─────────────────────────────────────────────────────

async function checkInvoiceOverdue(): Promise<number> {
  const today = new Date().toISOString().split('T')[0]

  const { data: invoices } = await supabaseAdmin
    .from('factures')
    .select('id, tenant_id, numero, montant_ttc, echeance, client_id')
    .lt('echeance', today)
    .eq('statut', 'envoyee')

  if (!invoices?.length) return 0

  for (const inv of invoices) {
    await fireTrigger({
      type: 'invoice.overdue',
      tenant_id: inv.tenant_id,
      data: {
        invoice: {
          id: inv.id,
          number: inv.numero,
          montant: inv.montant_ttc,
          echeance: inv.echeance,
        },
        client: { id: inv.client_id },
      },
      timestamp: new Date().toISOString(),
    })

    // Update invoice status to 'en_retard'
    await supabaseAdmin
      .from('factures')
      .update({ statut: 'en_retard' })
      .eq('id', inv.id)
      .eq('tenant_id', inv.tenant_id)
  }
  return invoices.length
}
