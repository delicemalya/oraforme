/**
 * scripts/seed-demo-data.ts
 * Sprint S-02 Phase 4 — Génération données démo Oraforme
 *
 * Usage : npx tsx scripts/seed-demo-data.ts
 *
 * Produit :
 *   8 employés · 30 fournisseurs · 3 comptes bancaires
 *   192 factures (24 mois) · 192 bulletins paie · 48 achats
 *   192 transactions · 96 mouvements stock
 *   ~1 400 écritures journal via moteur accounting_engine
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import * as dotenv from 'dotenv' // will use manual parse below

// ── 1. Charger .env.local ──────────────────────────────────────────────────
function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env.local')
  const content = fs.readFileSync(envPath, 'utf-8')
  const env: Record<string, string> = {}
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx === -1) continue
    const key = trimmed.slice(0, idx).trim()
    const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '')
    env[key] = val
  }
  return env
}

const env = loadEnv()
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY  = env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquant dans .env.local')
  process.exit(1)
}

const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
})

// ── 2. Helpers ──────────────────────────────────────────────────────────────
function log(msg: string) { console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`) }
function err(msg: string, e?: unknown) {
  console.error(`❌ ${msg}`, e instanceof Error ? e.message : e ?? '')
}

async function getTenantId(): Promise<string> {
  const { data, error } = await sb.from('tenants').select('id').order('created_at').limit(1).single()
  if (error || !data) throw new Error('Aucun tenant trouvé: ' + (error?.message ?? ''))
  return data.id as string
}

/** Round to nearest 1000 */
function r1k(n: number): number { return Math.round(n / 1000) * 1000 }

/** Pseudo-random déterministe : (seed * mult + add) % mod */
function det(seed: number, mult: number, add: number, mod: number): number {
  return ((seed * mult + add) % mod)
}

/** Calcul TVA Congo : TVA 18 %, CA 5 % × TVA, TTC = HT + TVA + CA */
function tva(ht: number) {
  const tv = Math.round(ht * 0.18)
  const ca = Math.round(tv  * 0.05)
  return { ht, tva: tv, ca, ttc: ht + tv + ca }
}

/** IRPP Congo tranches mensuelles sur brut */
function irpp(brut: number): number {
  if (brut <= 464000)  return 0
  if (brut <= 1000000) return Math.round((brut - 464000) * 0.01)
  if (brut <= 3000000) return Math.round(5360 + (brut - 1000000) * 0.10)
  if (brut <= 8000000) return Math.round(205360 + (brut - 3000000) * 0.25)
  return Math.round(1455360 + (brut - 8000000) * 0.40)
}

// ── 3. Données statiques ────────────────────────────────────────────────────
const CLIENTS = [
  'Cabinet Mukendi & Associés','Société Générale du Congo','BIC Congo',
  'CFAO Congo','Total Energies Congo','Perenco Congo','ENI Congo',
  'Bolloré Logistics','DHL Express Congo','Orange Congo',
  'MTN Congo','Airtel Congo','Panafrican Group','Alima Group',
  'BGFI Bank Congo','LCB Congo','Immobilière du Congo','Sogea Satom',
  'Razel Congo','Fayat Congo','Halliburton Congo','SLB Congo',
  'Congo Aviation','Hôtel Maya Maya','Restaurant Le Lézard',
  'SCUD Congo','SARIS Congo','Groupe Nzadi','Pharmacie Centrale',
  'Clinique Loandjili','Cabinet Expertise CG','Transport Lokolia',
  'Matériaux du Congo','Tech Solutions CG','Médias Tropicaux',
  'Constructions BZV','Agroalimentaire Congo','Logistique Afrique',
  'Électricité du Congo','Import-Export Brazza','STPU Congo',
  'Sucraf Congo','Saipem Congo','Résidence Flamboyants',
  'Traiteur Pointe-Noire','Brasserie du Congo','SNDE Congo',
  'Société Pétrolière Congo','Oraforme Demo SA','Tecnimont Congo',
]

const FOURNISSEURS = [
  'Imprimerie Centrale CG','Bureau Direct Congo','Fournitures Pro SARL',
  'Matériaux Brazza','EcoServices Congo','TechSupply CG','Congo Print SARL',
  'Papeterie du Fleuve','DataServices Africa','Cloud Congo SARL',
  'Net Congo Telecom','Maintenance Pro CG','Sécurité Plus Congo',
  'Gardiennage Congo','Nettoyage Express CG','Traiteur Brazzaville',
  'Transports Rapides CG','Livraisons Express Congo','Assurances Générales CG',
  'Assurances Pro SARL','Banque Habitat Congo','Crédit Foncier Congo',
  'Energie Congo SARL','Eau et Gaz Congo','SNDE Services',
  'Carburants du Congo','Air Liquide Congo','Pharma Équipements CG',
  'Info Conseil CG','Télécoms Services Congo',
]

const EMPLOYES = [
  { nom: 'Mabiala',   prenom: 'Jean',    poste: 'Directeur Général',        departement: 'Direction',  salaire_base: 800000, date_recrutement: '2020-01-15' },
  { nom: 'Nzouzi',    prenom: 'Marie',   poste: 'Responsable Comptabilité', departement: 'Finance',    salaire_base: 500000, date_recrutement: '2020-03-01' },
  { nom: 'Bouanga',   prenom: 'Pierre',  poste: 'Chargé de Paie',           departement: 'RH',         salaire_base: 400000, date_recrutement: '2021-01-10' },
  { nom: 'Moukassa',  prenom: 'Sophie',  poste: 'Commerciale Senior',        departement: 'Commercial', salaire_base: 450000, date_recrutement: '2021-06-01' },
  { nom: 'Loemba',    prenom: 'David',   poste: 'Gestionnaire Stocks',       departement: 'Logistique', salaire_base: 350000, date_recrutement: '2022-02-01' },
  { nom: 'Kintsioni', prenom: 'Rachel',  poste: 'Comptable',                 departement: 'Finance',    salaire_base: 420000, date_recrutement: '2021-09-01' },
  { nom: 'Mbemba',    prenom: 'Henri',   poste: 'Technicien Senior',         departement: 'Production', salaire_base: 380000, date_recrutement: '2022-04-01' },
  { nom: 'Yoka',      prenom: 'Carine',  poste: 'Assistante RH',             departement: 'RH',         salaire_base: 320000, date_recrutement: '2023-01-01' },
]

const PRODUITS = [
  { nom: 'Fournitures bureau',     categorie: 'Bureau',       sku: 'SKU-DEMO-001', prix_achat: 25000,  prix_vente: 40000  },
  { nom: 'Matériel informatique',  categorie: 'Informatique', sku: 'SKU-DEMO-002', prix_achat: 125000, prix_vente: 200000 },
  { nom: 'Mobilier de bureau',     categorie: 'Mobilier',     sku: 'SKU-DEMO-003', prix_achat: 180000, prix_vente: 290000 },
  { nom: 'Consommables impression',categorie: 'Impression',   sku: 'SKU-DEMO-004', prix_achat: 15000,  prix_vente: 25000  },
  { nom: 'Équipements réseau',     categorie: 'Réseau',       sku: 'SKU-DEMO-005', prix_achat: 85000,  prix_vente: 140000 },
  { nom: 'Pièces détachées',       categorie: 'Pièces',       sku: 'SKU-DEMO-006', prix_achat: 35000,  prix_vente: 60000  },
  { nom: 'Câblage électrique',     categorie: 'Câblage',      sku: 'SKU-DEMO-007', prix_achat: 12000,  prix_vente: 20000  },
  { nom: 'Écrans moniteurs',       categorie: 'Informatique', sku: 'SKU-DEMO-008', prix_achat: 95000,  prix_vente: 160000 },
  { nom: 'Claviers souris',        categorie: 'Informatique', sku: 'SKU-DEMO-009', prix_achat: 8000,   prix_vente: 15000  },
  { nom: 'Onduleurs UPS',          categorie: 'Électronique', sku: 'SKU-DEMO-010', prix_achat: 45000,  prix_vente: 80000  },
]

// ── 4. Main ─────────────────────────────────────────────────────────────────
async function main() {
  console.log('═══════════════════════════════════════════════════════')
  console.log('SPRINT S-02 PHASE 4 — Seed données démo Oraforme')
  console.log('═══════════════════════════════════════════════════════')

  const tid = await getTenantId()
  log(`Tenant : ${tid}`)

  const stats = {
    employes: 0, fournisseurs: 0, comptes: 0, produits: 0, warehouse: 0,
    factures: 0, bulletins: 0, achats: 0, transactions: 0, stock_mvts: 0,
    ae_fac001: 0, ae_fac002: 0, ae_pai001: 0, ae_ach001: 0,
    ae_errors: 0,
  }

  // ── A. Comptes bancaires ──────────────────────────────────────────────────
  {
    const { count } = await sb.from('comptes_bancaires').select('id', { count: 'exact', head: true }).eq('tenant_id', tid)
    if (!count || count < 3) {
      const { error } = await sb.from('comptes_bancaires').insert([
        { tenant_id: tid, banque: 'BGFI Bank Congo',  intitule: 'Compte exploitation BGFI',  numero_compte: '521001', solde: 45000000 },
        { tenant_id: tid, banque: 'LCB Congo',        intitule: 'Compte courant LCB',         numero_compte: '521002', solde: 28500000 },
        { tenant_id: tid, banque: 'BOCEC Congo',      intitule: 'Compte épargne BOCEC',       numero_compte: '521003', solde: 12000000 },
      ])
      if (error) err('comptes_bancaires', error)
      else { stats.comptes = 3; log('✓ 3 comptes bancaires créés') }
    } else { log(`✓ Comptes bancaires déjà présents (${count})`) }
  }

  // ── B. Caisse ────────────────────────────────────────────────────────────
  {
    const { count } = await sb.from('caisses').select('id', { count: 'exact', head: true }).eq('tenant_id', tid)
    if (!count) {
      await sb.from('caisses').insert({ tenant_id: tid, nom: 'Caisse principale', numero_compte: '571000', solde: 2500000 })
      log('✓ 1 caisse créée')
    }
  }

  // ── C. Employés ──────────────────────────────────────────────────────────
  {
    const { count } = await sb.from('employes').select('id', { count: 'exact', head: true }).eq('tenant_id', tid)
    if (!count || count < 8) {
      const rows = EMPLOYES.map(e => ({ tenant_id: tid, ...e, statut: 'actif', type_employe: 'permanent' }))
      // Insert one by one to skip duplicates
      for (const row of rows) {
        const { error } = await sb.from('employes').insert(row)
        if (!error) stats.employes++
      }
      log(`✓ ${stats.employes} employés créés`)
    } else { log(`✓ Employés déjà présents (${count})`) }
  }

  // Charger les IDs des employés
  const { data: empData } = await sb.from('employes')
    .select('id, nom, prenom, salaire_base')
    .eq('tenant_id', tid)
    .eq('statut', 'actif')
    .order('created_at')
    .limit(8)
  const employes = empData ?? []
  log(`  Employés actifs chargés : ${employes.length}`)

  // ── D. Fournisseurs ──────────────────────────────────────────────────────
  {
    const { count } = await sb.from('fournisseurs').select('id', { count: 'exact', head: true }).eq('tenant_id', tid)
    if (!count || count < 30) {
      const rows = FOURNISSEURS.map((nom, i) => ({
        tenant_id: tid, nom, contact: 'M. Contact Commercial',
        telephone: `+242 06 ${String((i * 77777 % 9000000 + 1000000)).slice(0, 7)}`,
        email: nom.toLowerCase().replace(/[^a-z0-9]/g, '') + '@four.cg',
        adresse: `BP ${100 + i * 17}, Brazzaville`, solde_du: 0,
      }))
      const { error } = await sb.from('fournisseurs').insert(rows)
      if (error) err('fournisseurs', error)
      else { stats.fournisseurs = 30; log('✓ 30 fournisseurs créés') }
    } else { log(`✓ Fournisseurs déjà présents (${count})`) }
  }

  const { data: foData } = await sb.from('fournisseurs').select('id').eq('tenant_id', tid).order('created_at').limit(30)
  const foIds = (foData ?? []).map(f => f.id as string)

  // ── E. Entrepôt ──────────────────────────────────────────────────────────
  let whId: string | null = null
  {
    const { data: wh } = await sb.from('warehouses').select('id').eq('tenant_id', tid).limit(1).single()
    if (!wh) {
      const { data: newWh, error } = await sb.from('warehouses')
        .insert({ tenant_id: tid, nom: 'Dépôt Principal', localisation: 'Brazzaville — Zone industrielle' })
        .select('id').single()
      if (!error && newWh) { whId = newWh.id as string; stats.warehouse = 1; log(`✓ Entrepôt créé : ${whId}`) }
    } else { whId = wh.id as string; log(`✓ Entrepôt existant : ${whId}`) }
  }

  // ── F. Produits ──────────────────────────────────────────────────────────
  {
    for (const p of PRODUITS) {
      const { error } = await sb.from('products').insert({ tenant_id: tid, ...p, unite: 'pièce' })
      if (!error) stats.produits++
    }
    if (stats.produits > 0) log(`✓ ${stats.produits} produits insérés`)
  }

  const { data: prodData } = await sb.from('products').select('id').eq('tenant_id', tid).order('created_at').limit(10)
  const prodIds = (prodData ?? []).map(p => p.id as string)
  log(`  Produits chargés : ${prodIds.length}`)

  // ── G. Factures (192 = 8/mois × 24 mois) ───────────────────────────────
  {
    const { count: existingFac } = await sb.from('factures').select('id', { count: 'exact', head: true }).eq('tenant_id', tid)
    log(`  Factures existantes : ${existingFac ?? 0}`)

    if (!existingFac || existingFac < 180) {
      let j = 0
      for (const year of [2024, 2025]) {
        for (let month = 1; month <= 12; month++) {
          // Seules les colonnes de migration 001 sont dans le schema cache PostgREST
          // (invoice_number, date, due_date, subtotal, ca, client_name = migration 010 → absentes du cache)
          const facBatch: Record<string, unknown>[] = []
          type FacMeta = { ht: number; tv: number; ca: number; ttc: number; invNum: string; dateStr: string; clientName: string; fStatus: string }
          const facMeta: FacMeta[] = []

          for (let i = 1; i <= 8; i++) {
            j++
            const clientName = CLIENTS[(j - 1) % 50]
            const ht = r1k(500000 + det(j, 97531, month * 314159 + year * 271, 4500000))
            const { tva: tv, ca, ttc } = tva(ht)
            const invNum = `FAC-${year}-${String(month).padStart(2, '0')}-${String(i).padStart(3, '0')}`
            const day = Math.min(28, i * 3 + 1)
            const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
            const fStatus = i % 2 === 0 ? 'payee' : 'envoyee'

            // INSERT avec colonnes migration 001 uniquement — created_at = date historique
            facBatch.push({ tenant_id: tid, client_nom: clientName, montant_ht: ht, total: ttc, statut: fStatus, created_at: dateStr })
            facMeta.push({ ht, tv, ca, ttc, invNum, dateStr, clientName, fStatus })
          }

          const { data: inserted, error } = await sb.from('factures').insert(facBatch).select('id')
          if (error) { err(`Factures ${year}/${month}`, error); continue }
          stats.factures += (inserted ?? []).length

          // emit FAC-001 + FAC-002 en utilisant les métadonnées locales
          for (let idx = 0; idx < (inserted ?? []).length; idx++) {
            const facId = (inserted![idx] as { id: string }).id
            const m = facMeta[idx]

            const { error: e1 } = await sb.rpc('emit_accounting_event', {
              p_tenant_id: tid, p_event_type: 'FAC-001',
              p_source_module: 'facturation', p_source_table: 'factures', p_source_id: facId,
              p_montant_ht: m.ht, p_montant_tva: m.tv, p_montant_ttc: m.ttc, p_montant_net: null,
              p_libelle: `Facture ${m.invNum} — ${m.clientName}`,
              p_date_event: m.dateStr, p_fiscal_year: year,
              p_metadata: { piece_number: m.invNum, client_name: m.clientName, ca: m.ca, country_code: 'CG' },
              p_event_version: 1,
            })
            if (e1) { stats.ae_errors++; if (stats.ae_errors <= 3) err('FAC-001', e1) }
            else stats.ae_fac001++

            if (m.fStatus === 'payee') {
              const payDate = `${year}-${String(month).padStart(2, '0')}-28`
              const { error: e2 } = await sb.rpc('emit_accounting_event', {
                p_tenant_id: tid, p_event_type: 'FAC-002',
                p_source_module: 'facturation', p_source_table: 'factures', p_source_id: facId,
                p_montant_ht: 0, p_montant_tva: 0, p_montant_ttc: m.ttc, p_montant_net: null,
                p_libelle: `Règlement ${m.invNum} — ${m.clientName}`,
                p_date_event: payDate, p_fiscal_year: year,
                p_metadata: { piece_number: m.invNum, client_name: m.clientName, mode_paiement: 'virement', country_code: 'CG' },
                p_event_version: 1,
              })
              if (e2) { stats.ae_errors++; if (stats.ae_errors <= 3) err('FAC-002', e2) }
              else stats.ae_fac002++
            }
          }
        }
        log(`✓ Factures ${year} : ${stats.factures} total insérées | FAC-001: ${stats.ae_fac001} | FAC-002: ${stats.ae_fac002}`)
      }
    } else { log(`✓ Factures déjà présentes (${existingFac}) — skip`) }
  }

  // ── H. Bulletins de paie (192 = 8 emp × 24 mois) ────────────────────────
  {
    const { count: existingBulletins } = await sb.from('bulletins_paie').select('id', { count: 'exact', head: true }).eq('tenant_id', tid)
    log(`  Bulletins existants : ${existingBulletins ?? 0}`)

    if (!existingBulletins || existingBulletins < 180) {
      for (const year of [2024, 2025]) {
        for (let month = 1; month <= 12; month++) {
          const batch: Record<string, unknown>[] = []

          for (const emp of employes) {
            // Vérifier si bulletin déjà existant
            const { count: existing } = await sb.from('bulletins_paie')
              .select('id', { count: 'exact', head: true })
              .eq('employe_id', emp.id)
              .eq('mois', month)
              .eq('annee', year)
            if (existing && existing > 0) continue

            const brut = Number(emp.salaire_base)
            const cnss_sal = Math.round(brut * 0.0504)
            const cnss_patro = Math.round(brut * 0.20285)
            const ir = irpp(brut)
            const net = brut - cnss_sal - ir

            batch.push({
              tenant_id: tid, employe_id: emp.id,
              mois: month, annee: year,
              salaire_base: brut, brut,
              cnss_salarie: cnss_sal, cnss_taux: 0.0504, cnss_patronal: cnss_patro,
              irpp: ir, total_retenues: cnss_sal + ir, net,
              cout_total_employeur: brut + cnss_patro, statut: 'validee',
            })
          }

          if (batch.length === 0) continue

          const { data: inserted, error } = await sb.from('bulletins_paie').insert(batch).select('id, employe_id, brut, cnss_patronal, cnss_salarie, irpp, net')
          if (error) { err(`Bulletins ${year}/${month}`, error); continue }
          stats.bulletins += (inserted ?? []).length

          // emit PAI-001 pour chaque bulletin
          for (const bull of (inserted ?? [])) {
            const empInfo = employes.find(e => e.id === bull.employe_id)
            const empNom = empInfo ? `${empInfo.nom} ${empInfo.prenom}` : 'Employé'
            const payDate = `${year}-${String(month).padStart(2, '0')}-25`

            const { error: e1 } = await sb.rpc('emit_accounting_event', {
              p_tenant_id: tid, p_event_type: 'PAI-001',
              p_source_module: 'paie', p_source_table: 'bulletins_paie', p_source_id: bull.id,
              p_montant_ht: Number(bull.brut), p_montant_tva: 0, p_montant_ttc: 0,
              p_montant_net: Number(bull.net),
              p_libelle: `Paie ${String(month).padStart(2, '0')}/${year} — ${empNom}`,
              p_date_event: payDate, p_fiscal_year: year,
              p_metadata: {
                cnss_patronal: Number(bull.cnss_patronal),
                cnss_salarie: Number(bull.cnss_salarie),
                irpp: Number(bull.irpp),
                employe_nom: empNom, mois: month, annee: year, country_code: 'CG',
              },
              p_event_version: 1,
            })
            if (e1) { stats.ae_errors++; if (stats.ae_errors <= 3) err('PAI-001', e1) }
            else stats.ae_pai001++
          }
        }
        log(`✓ Bulletins ${year} : ${stats.bulletins} | PAI-001: ${stats.ae_pai001}`)
      }
    } else { log(`✓ Bulletins déjà présents (${existingBulletins}) — skip`) }
  }

  // ── I. Achats fournisseurs (48) ──────────────────────────────────────────
  {
    const { count: existingAchats } = await sb.from('achats').select('id', { count: 'exact', head: true }).eq('tenant_id', tid)
    if (!existingAchats || existingAchats < 48) {
      let j = 0
      const DESCS = ['Fournitures et consommables','Services informatiques','Maintenance équipements','Carburant déplacements','Prestations externes']
      for (const year of [2024, 2025]) {
        for (let month = 1; month <= 12; month++) {
          for (let i = 1; i <= 2; i++) {
            j++
            const ht = r1k(100000 + det(j, 83333, month * 71111, 900000))
            const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(Math.min(28, i * 10)).padStart(2, '0')}`
            const foId = foIds[j % foIds.length] ?? foIds[0]

            const { data: achat, error } = await sb.from('achats')
              .insert({ tenant_id: tid, fournisseur_id: foId, description: DESCS[j % 5], montant: ht, statut: 'impaye', date: dateStr })
              .select('id').single()
            if (error || !achat) { err(`Achat ${year}/${month}`, error); continue }
            stats.achats++

            const { error: e1 } = await sb.rpc('emit_accounting_event', {
              p_tenant_id: tid, p_event_type: 'ACH-001',
              p_source_module: 'achats', p_source_table: 'achats', p_source_id: achat.id,
              p_montant_ht: ht, p_montant_tva: 0, p_montant_ttc: ht, p_montant_net: null,
              p_libelle: `Achat fournisseur ${String(month).padStart(2, '0')}/${year} #${j}`,
              p_date_event: dateStr, p_fiscal_year: year,
              p_metadata: { country_code: 'CG' },
              p_event_version: 1,
            })
            if (e1) { stats.ae_errors++; if (stats.ae_errors <= 3) err('ACH-001', e1) }
            else stats.ae_ach001++
          }
        }
      }
      log(`✓ Achats : ${stats.achats} | ACH-001: ${stats.ae_ach001}`)
    } else { log(`✓ Achats déjà présents (${existingAchats}) — skip`) }
  }

  // ── J. Transactions trésorerie (192) ─────────────────────────────────────
  {
    const { count: existingTx } = await sb.from('transactions').select('id', { count: 'exact', head: true }).eq('tenant_id', tid)
    if (!existingTx || existingTx < 180) {
      const CATS_IN  = ['Facturation','Facturation','Facturation','Autres recettes']
      const CATS_OUT = ['Paie','Loyer','Fournisseurs','Services']
      const rows: Record<string, unknown>[] = []

      for (const year of [2024, 2025]) {
        for (let month = 1; month <= 12; month++) {
          for (let i = 1; i <= 4; i++) {
            const day = Math.min(25, i * 6 + 1)
            const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
            const dayOut = Math.min(28, day + 3)
            const dateOutStr = `${year}-${String(month).padStart(2, '0')}-${String(dayOut).padStart(2, '0')}`
            const seed = year * 12 + month + i

            rows.push({
              tenant_id: tid, type: 'entree', categorie: CATS_IN[(i - 1) % 4],
              description: `Encaissement client ${String(month).padStart(2, '0')}/${year}`,
              montant: r1k(500000 + det(seed, 314159, 0, 3000000)),
              date: dateStr, mode_paiement: ['virement','especes','mobile_money'][i % 3],
              reference: `ENT-${year}${String(month).padStart(2,'0')}-${i}`,
            })
            rows.push({
              tenant_id: tid, type: 'sortie', categorie: CATS_OUT[(i - 1) % 4],
              description: `Décaissement ${CATS_OUT[(i - 1) % 4].toLowerCase()} ${String(month).padStart(2, '0')}/${year}`,
              montant: r1k(100000 + det(seed, 271828, 0, 1500000)),
              date: dateOutStr, mode_paiement: ['virement','cheque','especes'][i % 3],
              reference: `SOR-${year}${String(month).padStart(2,'0')}-${i}`,
            })
          }
        }
      }

      // Batch par 50
      for (let i = 0; i < rows.length; i += 50) {
        const { error } = await sb.from('transactions').insert(rows.slice(i, i + 50))
        if (!error) stats.transactions += Math.min(50, rows.length - i)
        else if (stats.ae_errors < 3) err('Transactions', error)
      }
      log(`✓ Transactions : ${stats.transactions}`)
    } else { log(`✓ Transactions déjà présentes (${existingTx}) — skip`) }
  }

  // ── K0. Ré-émission PAI-001 pour bulletins existants ────────────────────
  // (events en statut 'error' après reset → ON CONFLICT ne bloquera plus)
  {
    const { count: errPai } = await sb.from('accounting_events').select('id', { count: 'exact', head: true })
      .eq('tenant_id', tid).eq('event_type', 'PAI-001').eq('status', 'error')
    if (errPai && errPai > 0) {
      log(`Ré-émission PAI-001 pour ${errPai} events en erreur...`)
      const { data: allBulletins } = await sb.from('bulletins_paie')
        .select('id, employe_id, brut, cnss_patronal, cnss_salarie, irpp, net, mois, annee')
        .eq('tenant_id', tid).order('annee').order('mois')
      for (const bull of (allBulletins ?? [])) {
        const empInfo = employes.find(e => e.id === bull.employe_id)
        const empNom = empInfo ? `${empInfo.nom} ${empInfo.prenom}` : 'Employé'
        const payDate = `${bull.annee}-${String(bull.mois).padStart(2, '0')}-25`
        const { error: e1 } = await sb.rpc('emit_accounting_event', {
          p_tenant_id: tid, p_event_type: 'PAI-001',
          p_source_module: 'paie', p_source_table: 'bulletins_paie', p_source_id: bull.id,
          p_montant_ht: Number(bull.brut), p_montant_tva: 0, p_montant_ttc: 0,
          p_montant_net: Number(bull.net),
          p_libelle: `Paie ${String(bull.mois).padStart(2, '0')}/${bull.annee} — ${empNom}`,
          p_date_event: payDate, p_fiscal_year: Number(bull.annee),
          p_metadata: {
            cnss_patronal: Number(bull.cnss_patronal),
            cnss_salarie: Number(bull.cnss_salarie),
            irpp: Number(bull.irpp),
            employe_nom: empNom, mois: Number(bull.mois), annee: Number(bull.annee), country_code: 'CG',
          },
          p_event_version: 1,
        })
        if (e1) { stats.ae_errors++; if (stats.ae_errors <= 3) err('PAI-001 re-emit', e1) }
        else stats.ae_pai001++
      }
      log(`✓ PAI-001 ré-émis : ${stats.ae_pai001}`)
    }
  }

  // ── K0b. Ré-émission ACH-001 pour achats existants ───────────────────────
  {
    const { count: errAch } = await sb.from('accounting_events').select('id', { count: 'exact', head: true })
      .eq('tenant_id', tid).eq('event_type', 'ACH-001').eq('status', 'error')
    if (errAch && errAch > 0) {
      log(`Ré-émission ACH-001 pour ${errAch} events en erreur...`)
      const { data: allAchats } = await sb.from('achats')
        .select('id, montant, date').eq('tenant_id', tid).order('date')
      let a = 0
      for (const achat of (allAchats ?? [])) {
        a++
        const { error: e1 } = await sb.rpc('emit_accounting_event', {
          p_tenant_id: tid, p_event_type: 'ACH-001',
          p_source_module: 'achats', p_source_table: 'achats', p_source_id: achat.id,
          p_montant_ht: Number(achat.montant), p_montant_tva: 0, p_montant_ttc: Number(achat.montant),
          p_montant_net: null,
          p_libelle: `Achat fournisseur #${a}`,
          p_date_event: achat.date as string, p_fiscal_year: Number((achat.date as string).slice(0, 4)),
          p_metadata: { country_code: 'CG' },
          p_event_version: 1,
        })
        if (e1) { stats.ae_errors++; if (stats.ae_errors <= 3) err('ACH-001 re-emit', e1) }
        else stats.ae_ach001++
      }
      log(`✓ ACH-001 ré-émis : ${stats.ae_ach001}`)
    }
  }

  // ── K. Mouvements de stock (96) ──────────────────────────────────────────
  if (whId && prodIds.length > 0) {
    const { count: existingMvt } = await sb.from('stock_movements').select('id', { count: 'exact', head: true }).eq('tenant_id', tid)
    if (!existingMvt || existingMvt < 96) {
      const rows: Record<string, unknown>[] = []
      let j = 0
      for (const year of [2024, 2025]) {
        for (let month = 1; month <= 12; month++) {
          for (let i = 1; i <= 4; i++) {
            j++
            const prodId = prodIds[j % prodIds.length]
            const monthStr = `${year}-${String(month).padStart(2, '0')}`
            rows.push({
              tenant_id: tid, product_id: prodId, warehouse_id: whId,
              type: i <= 2 ? 'reception' : 'sortie',
              quantite: i <= 2 ? (10 + j * 7 % 40) : (3 + j * 3 % 12),
              reference: `${i <= 2 ? 'MVT-IN' : 'MVT-OUT'}-${year}-${String(month).padStart(2,'0')}-${i}`,
              note: `${i <= 2 ? 'Réception' : 'Consommation'} ${monthStr}`,
            })
          }
        }
      }
      const { error } = await sb.from('stock_movements').insert(rows)
      if (!error) { stats.stock_mvts = rows.length; log(`✓ Mouvements stock : ${stats.stock_mvts}`) }
      else err('stock_movements', error)
    } else { log(`✓ Mouvements stock déjà présents (${existingMvt}) — skip`) }
  }

  // ── L. Vérification finale ────────────────────────────────────────────────
  log('Vérification finale...')
  const [aeRes, jeRes, facRes, bulRes] = await Promise.all([
    sb.from('accounting_events').select('status', { count: 'exact' }).eq('tenant_id', tid),
    sb.from('journal_entries').select('id', { count: 'exact', head: true }).eq('tenant_id', tid),
    sb.from('factures').select('id', { count: 'exact', head: true }).eq('tenant_id', tid),
    sb.from('bulletins_paie').select('id', { count: 'exact', head: true }).eq('tenant_id', tid),
  ])

  const aeRows = aeRes.data ?? []
  const aeProcessed = aeRows.filter(r => r.status === 'processed').length
  const aeError = aeRows.filter(r => r.status === 'error').length
  const aePending = aeRows.filter(r => r.status === 'pending').length

  console.log('\n═══════════════════════════════════════════════════════')
  console.log('RÉSUMÉ FINAL — SPRINT S-02 PHASE 4')
  console.log('═══════════════════════════════════════════════════════')
  console.log(`Tenant                : ${tid}`)
  console.log(`Factures              : ${facRes.count ?? '?'}`)
  console.log(`Bulletins paie        : ${bulRes.count ?? '?'}`)
  console.log(`Achats                : ${stats.achats}`)
  console.log(`Transactions          : ${stats.transactions}`)
  console.log(`Mouvements stock      : ${stats.stock_mvts}`)
  console.log('─────────────────────────────────────────────────────')
  console.log(`Accounting events     : ${aeRows.length}`)
  console.log(`  ↳ processed         : ${aeProcessed}`)
  console.log(`  ↳ pending           : ${aePending}`)
  console.log(`  ↳ error             : ${aeError}`)
  console.log(`Journal entries       : ${jeRes.count ?? '?'}`)
  console.log('─────────────────────────────────────────────────────')
  console.log(`FAC-001 émis          : ${stats.ae_fac001}`)
  console.log(`FAC-002 émis          : ${stats.ae_fac002}`)
  console.log(`PAI-001 émis          : ${stats.ae_pai001}`)
  console.log(`ACH-001 émis          : ${stats.ae_ach001}`)
  console.log(`Erreurs emit          : ${stats.ae_errors}`)
  console.log('═══════════════════════════════════════════════════════')

  if (aeError > 0) {
    console.log('\n⚠️  Des erreurs existent dans accounting_events. Requête diagnostic :')
    const { data: errRows } = await sb.from('accounting_events')
      .select('event_type, error_message, source_table, date_event')
      .eq('tenant_id', tid).eq('status', 'error').limit(5)
    console.table(errRows ?? [])
  }
  if (aePending > 0) {
    console.log(`⚠️  ${aePending} events encore PENDING — le trigger ne les a pas traités.`)
  }
  if (aeProcessed > 0 && (jeRes.count ?? 0) < 100) {
    console.log('⚠️  Events processed mais peu d\'entrées journal — règles accounting_event_rules peut-être absentes.')
  }
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })
