/**
 * lib/email-templates.ts — Templates HTML emails Oraforme
 *
 * Architecture queue-first : insérer dans email_queue via queueEmail(),
 * puis un Edge Function / cron envoie via Resend (ou autre provider).
 *
 * Tous les templates sont responsive, bilingues (fr/en) et brandés Oraforme.
 */

import { supabase } from '@/lib/supabase'

// ── Brand config ──────────────────────────────────────────────────────────────

const BRAND = {
  name:    'Oraforme ERP',
  color:   '#DC2626',
  bg:      '#F5F7FB',
  footer:  'Oraforme — Système ERP intelligent pour l\'Afrique',
  website: 'https://oraforme.com',
}

// ── Base layout ───────────────────────────────────────────────────────────────

function baseLayout(content: string, title: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: ${BRAND.bg}; color: #0F172A; }
    .container { max-width: 600px; margin: 32px auto; background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,.08); }
    .header { background: ${BRAND.color}; padding: 28px 32px; text-align: center; }
    .header h1 { color: #fff; font-size: 22px; font-weight: 700; letter-spacing: -0.3px; }
    .header p { color: rgba(255,255,255,.8); font-size: 13px; margin-top: 4px; }
    .body { padding: 32px; }
    .footer { padding: 20px 32px; border-top: 1px solid #E5E7EB; text-align: center; font-size: 11px; color: #94A3B8; background: ${BRAND.bg}; }
    .btn { display: inline-block; background: ${BRAND.color}; color: #fff !important; text-decoration: none; padding: 12px 28px; border-radius: 10px; font-size: 14px; font-weight: 600; margin-top: 20px; }
    .divider { height: 1px; background: #E5E7EB; margin: 20px 0; }
    .amount { font-size: 28px; font-weight: 800; color: ${BRAND.color}; }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 600; }
    .badge-success { background: #F0FDF4; color: #16A34A; }
    .badge-warning { background: #FFFBEB; color: #D97706; }
    .badge-info    { background: #EFF6FF; color: #2563EB; }
    table.data { width: 100%; border-collapse: collapse; margin-top: 16px; }
    table.data th { background: ${BRAND.bg}; padding: 8px 12px; font-size: 11px; font-weight: 700; text-align: left; color: #64748B; text-transform: uppercase; letter-spacing: .5px; }
    table.data td { padding: 10px 12px; font-size: 13px; border-bottom: 1px solid #F1F5F9; }
    @media (max-width: 600px) {
      .body { padding: 20px; }
      .header { padding: 20px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${BRAND.name}</h1>
    </div>
    <div class="body">${content}</div>
    <div class="footer">
      <p>${BRAND.footer}</p>
      <p style="margin-top:6px">© ${new Date().getFullYear()} Oraforme. Tous droits réservés.</p>
    </div>
  </div>
</body>
</html>`
}

// ── Template: Facture ─────────────────────────────────────────────────────────

export interface InvoiceEmailParams {
  clientName: string
  invoiceNumber: string
  amount: string
  dueDate: string
  companyName: string
  invoiceUrl?: string
  items?: Array<{ description: string; quantity: number; price: string; total: string }>
}

export function invoiceEmailHtml(p: InvoiceEmailParams): string {
  const itemsTable = p.items?.length ? `
    <table class="data">
      <tr><th>Description</th><th>Qté</th><th>P.U.</th><th>Total</th></tr>
      ${p.items.map(i => `<tr><td>${i.description}</td><td>${i.quantity}</td><td>${i.price}</td><td>${i.total}</td></tr>`).join('')}
    </table>` : ''

  return baseLayout(`
    <p style="font-size:15px;font-weight:600">Bonjour ${p.clientName},</p>
    <p style="margin-top:12px;font-size:13px;color:#64748B">Veuillez trouver ci-joint votre facture.</p>
    <div class="divider"></div>
    <p style="font-size:12px;color:#94A3B8;font-weight:600;text-transform:uppercase;letter-spacing:.5px">Facture</p>
    <p style="font-size:18px;font-weight:700;margin-top:4px">${p.invoiceNumber}</p>
    <p style="margin-top:16px;font-size:12px;color:#94A3B8">Montant total</p>
    <div class="amount">${p.amount}</div>
    <p style="margin-top:12px;font-size:13px;color:#64748B">Date d'échéance : <strong>${p.dueDate}</strong></p>
    ${itemsTable}
    <div class="divider"></div>
    <p style="font-size:13px;color:#64748B">Émetteur : <strong>${p.companyName}</strong></p>
    ${p.invoiceUrl ? `<a href="${p.invoiceUrl}" class="btn">Voir la facture en ligne</a>` : ''}
    <div class="divider"></div>
    <p style="font-size:12px;color:#94A3B8">Pour toute question, contactez-nous directement.</p>
  `, `Facture ${p.invoiceNumber}`)
}

// ── Template: Devis ───────────────────────────────────────────────────────────

export interface DevisEmailParams {
  clientName: string
  devisNumber: string
  amount: string
  validUntil: string
  companyName: string
  devisUrl?: string
}

export function devisEmailHtml(p: DevisEmailParams): string {
  return baseLayout(`
    <p style="font-size:15px;font-weight:600">Bonjour ${p.clientName},</p>
    <p style="margin-top:12px;font-size:13px;color:#64748B">Nous avons le plaisir de vous adresser notre devis.</p>
    <div class="divider"></div>
    <p style="font-size:12px;color:#94A3B8;font-weight:600;text-transform:uppercase">Devis</p>
    <p style="font-size:18px;font-weight:700;margin-top:4px">${p.devisNumber}</p>
    <p style="margin-top:16px;font-size:12px;color:#94A3B8">Montant estimé</p>
    <div class="amount">${p.amount}</div>
    <p style="margin-top:12px;font-size:13px;color:#64748B">
      Valable jusqu'au : <strong>${p.validUntil}</strong>
      <span class="badge badge-warning" style="margin-left:8px">En attente</span>
    </p>
    <div class="divider"></div>
    <p style="font-size:13px;color:#64748B">Émetteur : <strong>${p.companyName}</strong></p>
    ${p.devisUrl ? `<a href="${p.devisUrl}" class="btn">Consulter le devis</a>` : ''}
    <div class="divider"></div>
    <p style="font-size:12px;color:#94A3B8">
      Pour accepter ce devis ou obtenir des informations complémentaires, contactez-nous.
    </p>
  `, `Devis ${p.devisNumber}`)
}

// ── Template: Paiement reçu ───────────────────────────────────────────────────

export interface PaiementEmailParams {
  clientName: string
  amount: string
  invoiceNumber: string
  date: string
  companyName: string
  receiptUrl?: string
}

export function paiementEmailHtml(p: PaiementEmailParams): string {
  return baseLayout(`
    <p style="font-size:15px;font-weight:600">Bonjour ${p.clientName},</p>
    <p style="margin-top:12px;font-size:13px;color:#64748B">Nous avons bien reçu votre paiement. Merci !</p>
    <div class="divider"></div>
    <span class="badge badge-success" style="font-size:13px;padding:6px 16px">✓ Paiement confirmé</span>
    <p style="margin-top:16px;font-size:12px;color:#94A3B8">Montant reçu</p>
    <div class="amount">${p.amount}</div>
    <p style="margin-top:12px;font-size:13px;color:#64748B">
      Facture : <strong>${p.invoiceNumber}</strong> · Date : <strong>${p.date}</strong>
    </p>
    <div class="divider"></div>
    <p style="font-size:13px;color:#64748B">Reçu de : <strong>${p.companyName}</strong></p>
    ${p.receiptUrl ? `<a href="${p.receiptUrl}" class="btn">Télécharger le reçu</a>` : ''}
  `, `Paiement reçu — ${p.invoiceNumber}`)
}

// ── Template: Bulletin de paie ────────────────────────────────────────────────

export interface BulletinEmailParams {
  employeeName: string
  period: string
  netPay: string
  companyName: string
  bulletinUrl?: string
}

export function bulletinEmailHtml(p: BulletinEmailParams): string {
  return baseLayout(`
    <p style="font-size:15px;font-weight:600">Bonjour ${p.employeeName},</p>
    <p style="margin-top:12px;font-size:13px;color:#64748B">
      Votre bulletin de paie pour la période <strong>${p.period}</strong> est disponible.
    </p>
    <div class="divider"></div>
    <p style="font-size:12px;color:#94A3B8">Salaire net à payer</p>
    <div class="amount">${p.netPay}</div>
    <div class="divider"></div>
    <p style="font-size:13px;color:#64748B">Société : <strong>${p.companyName}</strong></p>
    ${p.bulletinUrl ? `<a href="${p.bulletinUrl}" class="btn">Télécharger le bulletin</a>` : ''}
  `, `Bulletin de paie — ${p.period}`)
}

// ── Template: Rappel ──────────────────────────────────────────────────────────

export interface RappelEmailParams {
  recipientName: string
  subject: string
  message: string
  ctaLabel?: string
  ctaUrl?: string
  companyName: string
}

export function rappelEmailHtml(p: RappelEmailParams): string {
  return baseLayout(`
    <p style="font-size:15px;font-weight:600">Bonjour ${p.recipientName},</p>
    <p style="margin-top:12px;font-size:13px;color:#64748B">${p.message}</p>
    <div class="divider"></div>
    <p style="font-size:13px;color:#64748B">Cordialement,<br><strong>${p.companyName}</strong></p>
    ${p.ctaUrl && p.ctaLabel ? `<a href="${p.ctaUrl}" class="btn">${p.ctaLabel}</a>` : ''}
  `, p.subject)
}

// ── Queue function ─────────────────────────────────────────────────────────────

export interface QueueEmailOptions {
  tenantId: string
  toEmail: string
  toName?: string
  subject: string
  htmlBody: string
  template?: string
  params?: Record<string, unknown>
}

export async function queueEmail(opts: QueueEmailOptions): Promise<{ ok: boolean; id?: string }> {
  const { data, error } = await supabase
    .from('email_queue')
    .insert({
      tenant_id: opts.tenantId,
      to_email:  opts.toEmail,
      to_name:   opts.toName ?? null,
      subject:   opts.subject,
      html_body: opts.htmlBody,
      template:  opts.template ?? null,
      params:    opts.params ?? {},
      statut:    'pending',
    })
    .select('id')
    .single()

  if (error) return { ok: false }
  return { ok: true, id: (data as { id: string }).id }
}

// ── Convenience functions ─────────────────────────────────────────────────────

export async function sendInvoiceEmail(
  tenantId: string,
  toEmail: string,
  params: InvoiceEmailParams,
) {
  return queueEmail({
    tenantId,
    toEmail,
    toName: params.clientName,
    subject: `Facture ${params.invoiceNumber} — ${params.companyName}`,
    htmlBody: invoiceEmailHtml(params),
    template: 'facture',
    params: params as unknown as Record<string, unknown>,
  })
}

export async function sendDevisEmail(
  tenantId: string,
  toEmail: string,
  params: DevisEmailParams,
) {
  return queueEmail({
    tenantId,
    toEmail,
    toName: params.clientName,
    subject: `Devis ${params.devisNumber} — ${params.companyName}`,
    htmlBody: devisEmailHtml(params),
    template: 'devis',
    params: params as unknown as Record<string, unknown>,
  })
}

export async function sendPaiementEmail(
  tenantId: string,
  toEmail: string,
  params: PaiementEmailParams,
) {
  return queueEmail({
    tenantId,
    toEmail,
    toName: params.clientName,
    subject: `Paiement reçu — ${params.invoiceNumber}`,
    htmlBody: paiementEmailHtml(params),
    template: 'paiement',
    params: params as unknown as Record<string, unknown>,
  })
}
