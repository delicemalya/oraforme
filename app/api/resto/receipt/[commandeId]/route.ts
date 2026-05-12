import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { renderToBuffer } from '@react-pdf/renderer'
import { createElement } from 'react'
import type { DocumentProps } from '@react-pdf/renderer'
import type { ReactElement } from 'react'
import { ReceiptPDF } from '@/components/resto/ReceiptPDF'
import type { ReceiptData } from '@/components/resto/ReceiptPDF'
import { calculerTVACongo } from '@/lib/fiscalite-congo'
import { formatDateRecu, formatHeureRecu } from '@/lib/receipts'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ commandeId: string }> }
) {
  const { commandeId } = await params

  const { data: cmd } = await supabaseAdmin
    .from('resto_commandes')
    .select('*, tenants(nom_entreprise, entreprise_config(adresse, telephone))')
    .eq('id', commandeId)
    .single()

  if (!cmd) return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 })

  const items = (cmd.items ?? []) as { nom: string; quantite: number; prix: number }[]
  const sousTotal = items.reduce((s, it) => s + it.prix * it.quantite, 0)
  const { tva, ca, ttc } = calculerTVACongo(sousTotal)

  const tenant = cmd.tenants as { nom_entreprise?: string; entreprise_config?: { adresse?: string; telephone?: string }[] } | null
  const config = tenant?.entreprise_config?.[0]

  const createdAt = new Date(cmd.created_at)

  const receiptData: ReceiptData = {
    numero_recu:  cmd.numero_recu ?? cmd.id.slice(0, 8).toUpperCase(),
    date:         createdAt.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    heure:        createdAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
    table_num:    cmd.table_num ?? '',
    mode:         cmd.mode ?? 'sur_place',
    items,
    sous_total_ht: sousTotal,
    tva,
    ca,
    total_ttc:    ttc,
    mode_paiement: cmd.mode_paiement ?? cmd.paiement ?? 'especes',
    reference:    cmd.reference ?? null,
    nom_restaurant: tenant?.nom_entreprise ?? 'Restaurant',
    adresse:      config?.adresse ?? null,
    telephone:    config?.telephone ?? null,
  }

  try {
    const buffer = await renderToBuffer(
      createElement(ReceiptPDF, { data: receiptData }) as ReactElement<DocumentProps>
    )
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type':        'application/pdf',
        'Content-Disposition': `attachment; filename="recu-${receiptData.numero_recu}.pdf"`,
      },
    })
  } catch (err) {
    console.error('Receipt PDF error:', err)
    return NextResponse.json({ error: 'Erreur génération PDF' }, { status: 500 })
  }
}

