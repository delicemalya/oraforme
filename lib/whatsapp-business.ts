/**
 * lib/whatsapp-business.ts — WhatsApp Business Cloud API (Meta)
 *
 * Architecture :
 *  1. Les credentials (phone_number_id, access_token) sont stockés chiffrés
 *     dans whatsapp_config (Supabase, isolés par tenant).
 *  2. L'envoi réel est effectué côté serveur via /api/whatsapp/send.
 *  3. Chaque envoi est logué dans whatsapp_logs.
 *
 * Utilisation depuis un Server Component / API Route :
 *   import { WhatsappBusinessService } from '@/lib/whatsapp-business'
 *   const wa = new WhatsappBusinessService(tenantId)
 *   await wa.sendInvoice({ to: '+242...', invoiceNumber: 'FAC-001', ... })
 */

import { supabaseAdmin } from '@/lib/supabase-server'

const META_API_VERSION = 'v20.0'
const META_API_BASE    = `https://graph.facebook.com/${META_API_VERSION}`

// ── Types ──────────────────────────────────────────────────────────────────────

export interface WaConfig {
  phone_number_id:     string
  business_account_id: string
  access_token:        string
  webhook_secret:      string
  from_phone:          string
  actif:               boolean
}

export interface WaSendResult {
  ok:           boolean
  whatsapp_id?: string
  error?:       string
}

export interface SendInvoiceOpts {
  to:            string   // E.164 : +242XXXXXXXX
  toName?:       string
  invoiceNumber: string
  amount:        string   // "150 000 FCFA"
  clientName:    string
  dueDate?:      string   // "31/12/2026"
  companyName:   string
}

export interface SendQuoteOpts {
  to:          string
  toName?:     string
  quoteNumber: string
  amount:      string
  clientName:  string
  validUntil?: string
  companyName: string
}

export interface SendPayrollOpts {
  to:          string
  toName?:     string
  employeeName: string
  period:      string   // "Mai 2026"
  netSalary:   string
  companyName: string
}

export interface SendReminderOpts {
  to:          string
  toName?:     string
  invoiceNumber: string
  amount:      string
  daysOverdue: number
  companyName: string
}

export interface SendRecruitmentAlertOpts {
  to:          string
  toName?:     string
  candidateName: string
  position:    string
  action:      'convocation' | 'retenu' | 'rejete' | 'entretien'
  date?:       string
  companyName: string
}

export interface SendFiscalAlertOpts {
  to:          string
  toName?:     string
  alertType:   'tva' | 'cnss' | 'das' | 'patente' | 'is' | 'irpp' | 'autre'
  dueDate:     string
  amount?:     string
  companyName: string
}

export interface SendProfilReminderOpts {
  to:          string   // E.164 : +242XXXXXXXX
  toName?:     string
  companyName: string
  hoursLeft:   number   // heures restantes avant deadline
  dashboardUrl: string  // lien direct vers le popup
}

// ── Service ────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabaseAdmin as any

export class WhatsappBusinessService {
  private tenantId: string

  constructor(tenantId: string) {
    this.tenantId = tenantId
  }

  // ── Load tenant config ─────────────────────────────────────────────────────

  async getConfig(): Promise<WaConfig | null> {
    const { data } = await db
      .from('whatsapp_config')
      .select('phone_number_id,business_account_id,access_token,webhook_secret,from_phone,actif')
      .eq('tenant_id', this.tenantId)
      .maybeSingle()
    if (!data || !data.actif || !data.phone_number_id || !data.access_token) return null
    return data as WaConfig
  }

  // ── Core send ──────────────────────────────────────────────────────────────

  private async send(
    cfg:         WaConfig,
    to:          string,
    toName:      string | undefined,
    body:        string,
    templateName: string,
    context:     Record<string, unknown>,
  ): Promise<WaSendResult> {
    const phone = to.replace(/\s/g, '')

    const payload = {
      messaging_product: 'whatsapp',
      to:                phone,
      type:              'text',
      text:              { preview_url: false, body },
    }

    let whatsapp_id: string | undefined
    let errorMessage: string | undefined
    let status = 'sent'

    try {
      const res = await fetch(
        `${META_API_BASE}/${cfg.phone_number_id}/messages`,
        {
          method:  'POST',
          headers: {
            'Content-Type':  'application/json',
            Authorization:   `Bearer ${cfg.access_token}`,
          },
          body: JSON.stringify(payload),
        },
      )

      const json = await res.json() as { messages?: Array<{ id: string }>; error?: { message: string } }

      if (!res.ok) {
        status        = 'error'
        errorMessage  = json.error?.message ?? `HTTP ${res.status}`
      } else {
        whatsapp_id = json.messages?.[0]?.id
      }
    } catch (err) {
      status       = 'error'
      errorMessage = (err as Error).message
    }

    await db.from('whatsapp_logs').insert({
      tenant_id:     this.tenantId,
      to_phone:      phone,
      to_name:       toName ?? null,
      message_type:  'text',
      template_name: templateName,
      body,
      status,
      whatsapp_id:   whatsapp_id ?? null,
      error_message: errorMessage ?? null,
      context,
    })

    return errorMessage
      ? { ok: false, error: errorMessage }
      : { ok: true, whatsapp_id }
  }

  // ── sendInvoice ────────────────────────────────────────────────────────────

  async sendInvoice(opts: SendInvoiceOpts): Promise<WaSendResult> {
    const cfg = await this.getConfig()
    if (!cfg) return { ok: false, error: 'WhatsApp non configuré ou désactivé' }

    const due = opts.dueDate ? `\n📅 Échéance : ${opts.dueDate}` : ''
    const body =
      `[${opts.companyName}]\n` +
      `Bonjour ${opts.clientName || opts.toName || ''},\n\n` +
      `Votre facture *${opts.invoiceNumber}* d'un montant de *${opts.amount}* est disponible.${due}\n\n` +
      `Merci de votre confiance. 🙏`

    return this.send(cfg, opts.to, opts.toName, body, 'invoice_ready', {
      invoiceNumber: opts.invoiceNumber,
      amount: opts.amount,
    })
  }

  // ── sendQuote ──────────────────────────────────────────────────────────────

  async sendQuote(opts: SendQuoteOpts): Promise<WaSendResult> {
    const cfg = await this.getConfig()
    if (!cfg) return { ok: false, error: 'WhatsApp non configuré ou désactivé' }

    const valid = opts.validUntil ? `\n⏰ Valable jusqu'au : ${opts.validUntil}` : ''
    const body =
      `[${opts.companyName}]\n` +
      `Bonjour ${opts.clientName || opts.toName || ''},\n\n` +
      `Votre devis *${opts.quoteNumber}* d'un montant de *${opts.amount}* est prêt.${valid}\n\n` +
      `N'hésitez pas à nous contacter pour toute question. 📋`

    return this.send(cfg, opts.to, opts.toName, body, 'quote_ready', {
      quoteNumber: opts.quoteNumber,
      amount: opts.amount,
    })
  }

  // ── sendPayroll ────────────────────────────────────────────────────────────

  async sendPayroll(opts: SendPayrollOpts): Promise<WaSendResult> {
    const cfg = await this.getConfig()
    if (!cfg) return { ok: false, error: 'WhatsApp non configuré ou désactivé' }

    const body =
      `[${opts.companyName}]\n` +
      `Bonjour ${opts.employeeName},\n\n` +
      `💰 Votre bulletin de paie *${opts.period}* est disponible.\n` +
      `Salaire net : *${opts.netSalary}*\n\n` +
      `Consultez votre espace employé pour le télécharger. 📄`

    return this.send(cfg, opts.to, opts.toName, body, 'payroll_ready', {
      period: opts.period,
      netSalary: opts.netSalary,
    })
  }

  // ── sendReminder ───────────────────────────────────────────────────────────

  async sendReminder(opts: SendReminderOpts): Promise<WaSendResult> {
    const cfg = await this.getConfig()
    if (!cfg) return { ok: false, error: 'WhatsApp non configuré ou désactivé' }

    const urgence = opts.daysOverdue >= 30 ? '🔴 URGENT — ' : opts.daysOverdue >= 7 ? '🟠 ' : '🟡 '
    const body =
      `${urgence}[${opts.companyName}]\n\n` +
      `Rappel de paiement — Facture *${opts.invoiceNumber}*\n` +
      `Montant dû : *${opts.amount}*\n` +
      `En retard de *${opts.daysOverdue} jour(s)*\n\n` +
      `Merci de régulariser votre situation. ⚠️`

    return this.send(cfg, opts.to, opts.toName, body, 'payment_reminder', {
      invoiceNumber: opts.invoiceNumber,
      daysOverdue: opts.daysOverdue,
    })
  }

  // ── sendRecruitmentAlert ───────────────────────────────────────────────────

  async sendRecruitmentAlert(opts: SendRecruitmentAlertOpts): Promise<WaSendResult> {
    const cfg = await this.getConfig()
    if (!cfg) return { ok: false, error: 'WhatsApp non configuré ou désactivé' }

    const messages: Record<typeof opts.action, string> = {
      convocation: `📅 Vous êtes convoqué(e) pour un entretien${opts.date ? ` le *${opts.date}*` : ''}.\nPoste : *${opts.position}*`,
      entretien:   `✅ Votre entretien pour le poste *${opts.position}* est confirmé${opts.date ? ` le *${opts.date}*` : ''}.`,
      retenu:      `🎉 Félicitations ! Vous avez été retenu(e) pour le poste *${opts.position}*.`,
      rejete:      `Merci pour votre candidature au poste *${opts.position}*. Nous n'avons pas retenu votre dossier cette fois.`,
    }

    const body =
      `[${opts.companyName}]\n` +
      `Bonjour ${opts.candidateName},\n\n` +
      `${messages[opts.action]}\n\n` +
      `Bonne continuation. 🤝`

    return this.send(cfg, opts.to, opts.toName, body, `recruitment_${opts.action}`, {
      position: opts.position,
      action: opts.action,
    })
  }

  // ── sendFiscalAlert ────────────────────────────────────────────────────────

  async sendFiscalAlert(opts: SendFiscalAlertOpts): Promise<WaSendResult> {
    const cfg = await this.getConfig()
    if (!cfg) return { ok: false, error: 'WhatsApp non configuré ou désactivé' }

    const labels: Record<typeof opts.alertType, string> = {
      tva:     'Déclaration TVA',
      cnss:    'Cotisations CNSS',
      das:     'DAS employeur',
      patente: 'Patente & taxes locales',
      is:      "Impôt sur les Sociétés (IS)",
      irpp:    "IRPP employés",
      autre:   'Obligation fiscale',
    }

    const amount = opts.amount ? `\nMontant estimé : *${opts.amount}*` : ''
    const body =
      `🏛️ [${opts.companyName}] Alerte Fiscale\n\n` +
      `📋 *${labels[opts.alertType]}*\n` +
      `📅 Date limite : *${opts.dueDate}*${amount}\n\n` +
      `⚠️ Pensez à préparer vos déclarations à temps pour éviter les pénalités.`

    return this.send(cfg, opts.to, opts.toName, body, `fiscal_${opts.alertType}`, {
      alertType: opts.alertType,
      dueDate: opts.dueDate,
    })
  }

  // ── sendProfilCompletionReminder ──────────────────────────────────────────

  async sendProfilCompletionReminder(opts: SendProfilReminderOpts): Promise<WaSendResult> {
    const cfg = await this.getConfig()
    if (!cfg) return { ok: false, error: 'WhatsApp non configuré ou désactivé' }

    const urgence = opts.hoursLeft <= 0
      ? '🔴 DÉLAI DÉPASSÉ'
      : opts.hoursLeft <= 24
        ? `🔴 URGENT — ${opts.hoursLeft}h restantes`
        : opts.hoursLeft <= 48
          ? `🟠 ${opts.hoursLeft}h restantes`
          : `🟡 ${opts.hoursLeft}h restantes`

    const body =
      `[Oraforme] ${urgence}\n\n` +
      `Bonjour ${opts.toName ?? opts.companyName},\n\n` +
      `Votre profil entreprise *${opts.companyName}* est incomplet.\n` +
      `Finalisez-le pour :\n` +
      `• Apparaître sur vos factures et documents\n` +
      `• Débloquer toutes les fonctionnalités\n` +
      `• Recevoir les rappels fiscaux\n\n` +
      `👉 ${opts.dashboardUrl}\n\n` +
      `Equipe Oraforme`

    return this.send(cfg, opts.to, opts.toName, body, 'profil_completion_reminder', {
      hoursLeft: opts.hoursLeft,
    })
  }
}

// ── Singleton factory (server-side only) ──────────────────────────────────────

export function createWhatsappService(tenantId: string): WhatsappBusinessService {
  return new WhatsappBusinessService(tenantId)
}
