/**
 * lib/messaging.ts — Abstraction SMS / WhatsApp (provider-agnostic)
 *
 * Architecture queue-first : tous les messages sont d'abord insérés dans
 * `sms_queue` (Supabase). Un Edge Function ou cron peut les envoyer via
 * Twilio, Vonage, Orange API, etc. sans modifier ce fichier.
 *
 * Usage:
 *   await sendSMS({ tenantId, to: '+242...', message: 'Bonjour' })
 *   await sendWhatsApp({ tenantId, to: '+242...', message: '...' })
 */

import { supabase } from '@/lib/supabase'

// ── Types ──────────────────────────────────────────────────────────────────────

export type SMSProvider = 'twilio' | 'vonage' | 'orange' | 'airtel'
export type SMSChannel  = 'sms' | 'whatsapp'

export interface SendSMSOptions {
  tenantId: string
  to: string         // E.164 format: +242XXXXXXXX
  toName?: string
  message: string
  provider?: SMSProvider
  params?: Record<string, unknown>
}

export interface SendWhatsAppOptions extends Omit<SendSMSOptions, 'provider'> {
  provider?: SMSProvider
}

export interface QueueResult {
  id: string | null
  ok: boolean
  error?: string
}

// ── Core queue function ────────────────────────────────────────────────────────

async function queueMessage(
  opts: SendSMSOptions,
  channel: SMSChannel,
): Promise<QueueResult> {
  const { data, error } = await supabase
    .from('sms_queue')
    .insert({
      tenant_id: opts.tenantId,
      to_phone:  opts.to,
      to_name:   opts.toName ?? null,
      message:   opts.message,
      provider:  opts.provider ?? 'twilio',
      channel,
      statut:    'pending',
      params:    opts.params ?? {},
    })
    .select('id')
    .single()

  if (error) return { id: null, ok: false, error: error.message }
  return { id: (data as { id: string }).id, ok: true }
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Queue an SMS message. Sent asynchronously by Edge Function / cron.
 */
export async function sendSMS(opts: SendSMSOptions): Promise<QueueResult> {
  return queueMessage(opts, 'sms')
}

/**
 * Queue a WhatsApp message. Requires WhatsApp Business API provider.
 */
export async function sendWhatsApp(opts: SendWhatsAppOptions): Promise<QueueResult> {
  return queueMessage({ ...opts, provider: opts.provider ?? 'twilio' }, 'whatsapp')
}

/**
 * Queue a bulk SMS broadcast (up to 100 recipients).
 */
export async function sendBulkSMS(
  tenantId: string,
  recipients: Array<{ to: string; toName?: string }>,
  message: string,
  provider: SMSProvider = 'twilio',
): Promise<{ queued: number; failed: number }> {
  const rows = recipients.slice(0, 100).map(r => ({
    tenant_id: tenantId,
    to_phone:  r.to,
    to_name:   r.toName ?? null,
    message,
    provider,
    channel:   'sms' as SMSChannel,
    statut:    'pending',
    params:    {},
  }))

  const { data, error } = await supabase.from('sms_queue').insert(rows).select('id')
  if (error) return { queued: 0, failed: rows.length }
  return { queued: (data ?? []).length, failed: rows.length - (data ?? []).length }
}

// ── Template helpers ───────────────────────────────────────────────────────────

export function smsInvoiceReady(invoiceNumber: string, amount: string, companyName: string): string {
  return `[${companyName}] Facture ${invoiceNumber} d'un montant de ${amount} est disponible. Merci pour votre confiance.`
}

export function smsPaiementRecu(amount: string, companyName: string): string {
  return `[${companyName}] Paiement de ${amount} reçu. Merci !`
}

export function smsDevisAccepte(devisNumber: string, companyName: string): string {
  return `[${companyName}] Votre devis ${devisNumber} a été accepté. Nous vous contacterons bientôt.`
}

export function smsRappelEcheance(title: string, daysLeft: number, companyName: string): string {
  return `[${companyName}] Rappel : ${title} dans ${daysLeft} jour(s). Pensez à anticiper.`
}
