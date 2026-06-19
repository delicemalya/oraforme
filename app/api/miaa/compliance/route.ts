/**
 * POST /api/miaa/compliance
 *
 * MIAA Compliance OHADA — Analyse complète et réponse IA.
 * Combine :
 *   1. Données réelles (audit engine + balance + journal)
 *   2. Analyse IA (agent conformite)
 *   3. Plan d'action priorisé
 *
 * Body : { question?, mode? }
 *   mode: 'score' | 'anomalies' | 'fiscal' | 'social' | 'balance' | 'full'
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireTenant, checkPlanAccess } from '@/lib/api/require-tenant'
import { supabaseAdmin } from '@/lib/supabase-server'
import {
  runAuditGlobal,
  sauvegarderAudit,
  type AuditGlobal,
  type AuditAnomalie,
} from '@/lib/audit/engine'
import Anthropic from '@anthropic-ai/sdk'
import { MIAA_AGENTS } from '@/lib/miaa-agents'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db       = supabaseAdmin as any
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export const dynamic    = 'force-dynamic'
export const maxDuration = 60

const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(Math.round(n))

// ── Formater les anomalies pour le prompt IA ──────────────────────────────────

function formatAnomalies(anomalies: AuditAnomalie[], niveau?: string): string {
  const filtered = niveau ? anomalies.filter(a => a.niveau === niveau) : anomalies
  if (!filtered.length) return '✅ Aucune anomalie détectée.'
  return filtered.map(a =>
    `[${a.code}] ${a.niveau.toUpperCase()}: ${a.titre}\n  → ${a.description}\n  Impact: ${a.impact}\n  Action: ${a.recommandation}${a.reference ? `\n  Réf: ${a.reference}` : ''}`
  ).join('\n\n')
}

// ── Construire le contexte d'audit pour le prompt IA ─────────────────────────

function buildAuditContext(audit: AuditGlobal): string {
  const scoreEmoji = (s: number) => s >= 85 ? '✅' : s >= 70 ? '⚠️' : s >= 50 ? '🟠' : '🔴'
  const critiques  = audit.anomalies.filter(a => a.niveau === 'critical')
  const erreurs    = audit.anomalies.filter(a => a.niveau === 'error')
  const warnings   = audit.anomalies.filter(a => a.niveau === 'warning')

  return `
## RAPPORT D'AUDIT OHADA EN TEMPS RÉEL
Date : ${new Date().toLocaleDateString('fr-FR')}

### SCORES DE CONFORMITÉ
| Domaine | Score |
|---------|-------|
| 🏆 Score Global | ${audit.score_global}/100 |
| ${scoreEmoji(audit.score_comptable)} Comptabilité SYSCOHADA | ${audit.score_comptable}/100 |
| ${scoreEmoji(audit.score_financier)} Finances & Trésorerie | ${audit.score_financier}/100 |
| ${scoreEmoji(audit.score_fiscal)} Fiscalité (TVA/IS/Patente) | ${audit.score_fiscal}/100 |
| ${scoreEmoji(audit.score_rh)} RH & Obligations Sociales | ${audit.score_rh}/100 |
| ${scoreEmoji(audit.score_controle)} Contrôle Interne | ${audit.score_controle}/100 |
| ${scoreEmoji(audit.score_ohada)} Conformité OHADA | ${audit.score_ohada}/100 |

### RÉSUMÉ
- Anomalies totales : ${audit.nb_anomalies}
- Anomalies critiques : ${audit.nb_critiques} 🔴
- Anomalies erreurs : ${erreurs.length} 🟠
- Avertissements : ${warnings.length} 🟡

### ANOMALIES CRITIQUES (action immédiate)
${formatAnomalies(critiques)}

### ANOMALIES ERREURS (corriger sous 7 jours)
${formatAnomalies(erreurs)}

### AVERTISSEMENTS (corriger sous 30 jours)
${formatAnomalies(warnings)}
`.trim()
}

// ── Balance rapide depuis journal_entries ─────────────────────────────────────

async function getBalanceSummary(tenantId: string): Promise<string> {
  const year = new Date().getFullYear()
  const { data: entries } = await db
    .from('journal_entries')
    .select('debit_account, credit_account, montant')
    .eq('tenant_id', tenantId)
    .eq('fiscal_year', year)
    .limit(5000)

  if (!entries?.length) return 'Aucune écriture comptable pour ' + year

  const totals = new Map<number, { debit: number; credit: number }>()
  for (const e of entries) {
    if (e.debit_account) {
      const cl = parseInt(e.debit_account[0]) || 0
      const t  = totals.get(cl) ?? { debit: 0, credit: 0 }
      t.debit += e.montant ?? 0
      totals.set(cl, t)
    }
    if (e.credit_account) {
      const cl = parseInt(e.credit_account[0]) || 0
      const t  = totals.get(cl) ?? { debit: 0, credit: 0 }
      t.credit += e.montant ?? 0
      totals.set(cl, t)
    }
  }

  const totalDebit  = Array.from(totals.values()).reduce((s, t) => s + t.debit, 0)
  const totalCredit = Array.from(totals.values()).reduce((s, t) => s + t.credit, 0)
  const ecart       = Math.abs(totalDebit - totalCredit)

  const classNames: Record<number, string> = {
    1: 'Capitaux', 2: 'Immobilisations', 3: 'Stocks', 4: 'Tiers',
    5: 'Trésorerie', 6: 'Charges', 7: 'Produits', 8: 'HAO', 9: 'Analytique',
  }

  const lines = Array.from(totals.entries()).sort((a, b) => a[0] - b[0]).map(([cl, t]) => {
    const solde = t.debit - t.credit
    return `Cl.${cl} ${classNames[cl] ?? '?'}: Débit ${fmt(t.debit)} | Crédit ${fmt(t.credit)} | Solde ${solde >= 0 ? '+' : ''}${fmt(solde)}`
  })

  return [
    `Balance ${year} (${entries.length} écritures) :`,
    ...lines,
    ``,
    `TOTAL Débit   : ${fmt(totalDebit)} FCFA`,
    `TOTAL Crédit  : ${fmt(totalCredit)} FCFA`,
    `Équilibre     : ${ecart < 1 ? '✅ Balancé' : `⚠️ Écart de ${fmt(ecart)} FCFA`}`,
  ].join('\n')
}

// ── Handler principal ─────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const ctx = await requireTenant(req)
  if (!ctx.ok) return ctx.error

  const planDenied = await checkPlanAccess(ctx.tid, 'audit-comptable')
  if (planDenied) return planDenied

  const body = await req.json() as { question?: string; mode?: string }
  const question = body.question?.trim() || 'Donne-moi le score de conformité OHADA complet et les anomalies prioritaires.'
  const mode     = body.mode ?? 'full'

  // Récupérer les infos entreprise
  const { data: tenant } = await db
    .from('tenants')
    .select('nom_entreprise, secteur, pays')
    .eq('id', ctx.tid)
    .maybeSingle()

  const entreprise = tenant?.nom_entreprise ?? 'Votre entreprise'

  // Exécuter l'audit complet
  const audit = await runAuditGlobal(supabaseAdmin, ctx.tid)
  await sauvegarderAudit(supabaseAdmin, ctx.tid, audit)

  // Balance si demandée
  let balanceCtx = ''
  if (mode === 'balance' || mode === 'full') {
    balanceCtx = await getBalanceSummary(ctx.tid)
  }

  // Construire le contexte audit
  const auditContext = buildAuditContext(audit)
  const agent        = MIAA_AGENTS.conformite

  const systemPrompt = `${agent.personnalite}

Tu travailles pour : ${entreprise} (${tenant?.secteur ?? 'entreprise'}, ${tenant?.pays ?? 'Congo-Brazzaville'})

${auditContext}

${balanceCtx ? `### BALANCE GÉNÉRALE\n${balanceCtx}` : ''}

Réponds en français. Sois précis et actionnable. Cite toujours les codes d'anomalie (SC001, T001, etc.) et les références légales.
Structure ta réponse avec des sections claires : Score → Anomalies prioritaires → Plan d'action.`

  const res = await anthropic.messages.create({
    model:      'claude-haiku-4-5-20251001',
    max_tokens: 4000,
    system:     systemPrompt,
    messages:   [{ role: 'user', content: question }],
  })

  const answer = res.content[0]?.type === 'text' ? res.content[0].text : ''

  // Journaliser dans miaa_conversations
  db.from('miaa_conversations').insert({
    tenant_id:    ctx.tid,
    module:       'conformite',
    message_user: question,
    message_miaa: answer,
    created_at:   new Date().toISOString(),
  }).then(() => {}, () => {})

  return NextResponse.json({
    ok:            true,
    answer,
    audit_score:   audit.score_global,
    scores: {
      comptable:  audit.score_comptable,
      financier:  audit.score_financier,
      fiscal:     audit.score_fiscal,
      rh:         audit.score_rh,
      controle:   audit.score_controle,
      ohada:      audit.score_ohada,
    },
    nb_anomalies: audit.nb_anomalies,
    nb_critiques: audit.nb_critiques,
    anomalies:    audit.anomalies.slice(0, 20),
    model:        'claude-haiku',
  })
}

// ── GET — Score rapide (sans IA) ──────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const ctx = await requireTenant(req)
  if (!ctx.ok) return ctx.error

  // Retourner le dernier score sauvegardé
  const { data: score } = await db
    .from('audit_scores')
    .select('*')
    .eq('tenant_id', ctx.tid)
    .maybeSingle()

  if (!score) {
    // Calculer si pas encore fait
    const audit = await runAuditGlobal(supabaseAdmin, ctx.tid)
    await sauvegarderAudit(supabaseAdmin, ctx.tid, audit)
    return NextResponse.json({
      ok:           true,
      score_global: audit.score_global,
      scores: {
        comptable: audit.score_comptable,
        financier: audit.score_financier,
        fiscal:    audit.score_fiscal,
        rh:        audit.score_rh,
        controle:  audit.score_controle,
        ohada:     audit.score_ohada,
      },
      nb_anomalies: audit.nb_anomalies,
      nb_critiques: audit.nb_critiques,
      computed_at:  audit.computed_at,
      fresh:        true,
    })
  }

  return NextResponse.json({
    ok:           true,
    score_global: score.score_global,
    scores: {
      comptable: score.score_comptable,
      financier: score.score_financier,
      fiscal:    score.score_fiscal,
      rh:        score.score_rh,
      controle:  score.score_controle,
      ohada:     score.score_ohada,
    },
    nb_anomalies: score.nb_anomalies,
    nb_critiques: score.nb_critiques,
    computed_at:  score.computed_at,
    fresh:        false,
  })
}
