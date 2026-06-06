// Formulaire officiel DGI Congo — Déclaration Générale des Impôts et Taxes
// Format A4, reproduit la structure officielle DGID

import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import { montantEnLettres } from '@/lib/declarations/declaration-generale'

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  page:       { fontFamily: 'Helvetica', fontSize: 8, padding: '20 28', backgroundColor: '#fff', color: '#0F172A' },
  // Header
  header:     { flexDirection: 'row', borderBottom: '2px solid #1E3A5F', paddingBottom: 8, marginBottom: 10 },
  headerLeft: { flex: 1, fontSize: 7, color: '#374151' },
  headerMid:  { flex: 2, alignItems: 'center' },
  headerRight:{ flex: 1, alignItems: 'flex-end', fontSize: 7, color: '#374151' },
  titleMain:  { fontSize: 10, fontFamily: 'Helvetica-Bold', textAlign: 'center', color: '#1E3A5F' },
  titleSub:   { fontSize: 7.5, textAlign: 'center', color: '#374151', marginTop: 2 },
  badge:      { marginTop: 4, padding: '2 6', backgroundColor: '#1E3A5F', color: '#fff', fontSize: 7, borderRadius: 3, alignSelf: 'center' },
  // Section headers
  sectionTitle: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: '#1E3A5F', borderBottom: '1px solid #1E3A5F', paddingBottom: 2, marginBottom: 5, marginTop: 8, textTransform: 'uppercase' },
  // Identification
  row2:       { flexDirection: 'row', gap: 8, marginBottom: 4 },
  field:      { flex: 1 },
  label:      { fontSize: 6.5, color: '#6B7280', marginBottom: 1, textTransform: 'uppercase', letterSpacing: 0.3 },
  value:      { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#111827', borderBottom: '0.5px solid #D1D5DB', paddingBottom: 1 },
  // Table
  table:      { border: '0.5px solid #CBD5E1', marginTop: 4 },
  thead:      { flexDirection: 'row', backgroundColor: '#1E3A5F', color: '#fff' },
  th:         { fontSize: 6.5, fontFamily: 'Helvetica-Bold', padding: '3 4', borderRight: '0.5px solid rgba(255,255,255,0.3)' },
  tr:         { flexDirection: 'row', borderBottom: '0.5px solid #E2E8F0' },
  trAlt:      { flexDirection: 'row', borderBottom: '0.5px solid #E2E8F0', backgroundColor: '#F8FAFC' },
  trHighlight:{ flexDirection: 'row', borderBottom: '0.5px solid #E2E8F0', backgroundColor: '#FEF3C7' },
  trTotal:    { flexDirection: 'row', backgroundColor: '#1E3A5F', color: '#fff' },
  td:         { fontSize: 7, padding: '2.5 4', borderRight: '0.5px solid #E2E8F0' },
  tdNum:      { width: 20 },
  tdNature:   { flex: 1 },
  tdAmt:      { width: 72, textAlign: 'right' },
  tdTotal:    { width: 72, textAlign: 'right', fontFamily: 'Helvetica-Bold' },
  // Payment
  payRow:     { flexDirection: 'row', gap: 12, marginTop: 6 },
  payField:   { flex: 1 },
  checkbox:   { flexDirection: 'row', gap: 4, alignItems: 'center' },
  box:        { width: 8, height: 8, border: '0.8px solid #374151' },
  boxFilled:  { width: 8, height: 8, border: '0.8px solid #1E3A5F', backgroundColor: '#1E3A5F' },
  // Footer
  footer:     { position: 'absolute', bottom: 16, left: 28, right: 28, borderTop: '0.5px solid #CBD5E1', paddingTop: 4, flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { fontSize: 6, color: '#9CA3AF' },
  // Signature
  sigRow:     { flexDirection: 'row', marginTop: 10, gap: 20 },
  sigBox:     { flex: 1, border: '0.5px solid #CBD5E1', padding: 8, minHeight: 40, borderRadius: 3 },
  sigLabel:   { fontSize: 6.5, color: '#6B7280', marginBottom: 12 },
})

// ─── Interface ────────────────────────────────────────────────────────────────

export interface DGIData {
  mois: number; annee: number
  niu?: string; denomination_sociale?: string; adresse?: string
  telephone?: string; email?: string; ville?: string; residence_fiscale?: string
  l1_droits_accises?: number; l2_taxe_boissons_tabac?: number
  l3_tva?: number; l3_tva_centimes?: number
  l4_tva_tiers?: number; l4_tva_tiers_centimes?: number
  l5_taxe_transferts_fonds?: number; l6_taxe_jeux_hasard?: number
  l7_irpp_bic_bnc?: number
  l8_irpp_salaires?: number; l8_nb_employes?: number; l8_salaires_bruts?: number
  l9_tus?: number; l9_salaires_bruts?: number
  l10_is?: number; l11_isf?: number; l12_tss?: number; l13_tvts?: number
  l14_irvm?: number; l15_ras_20pct?: number; l16_ras_5pct?: number
  l17_ras_btp?: number; l18_asdi?: number; l19_taxe_appareils?: number
  l20_rav?: number; l21_redevances?: number; l22_taxe_assurance?: number
  l23_taxe_immobiliere?: number; l24_tol?: number; l25_taxe_regionale?: number
  l26_contrib_fonciere_baties?: number; l27_contrib_fonciere_non_baties?: number
  total_principal?: number; total_centimes?: number
  total_penalites?: number; total_droits_payes?: number
  mode_paiement?: string; reference_cheque?: string
  lieu_signature?: string; date_signature?: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MOIS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin',
  'Juillet','Août','Septembre','Octobre','Novembre','Décembre']

function n(v?: number): string {
  if (!v || v === 0) return '—'
  return new Intl.NumberFormat('fr-FR').format(Math.round(v))
}

// ─── Tax line definitions ──────────────────────────────────────────────────────

function lignes(d: DGIData): Array<{
  num: number; nature: string; principal: number; centimes: number; highlight?: boolean
}> {
  return [
    { num: 1,  nature: "Droits d'accises",                       principal: d.l1_droits_accises ?? 0,            centimes: 0 },
    { num: 2,  nature: 'Taxe sur boissons et tabac',             principal: d.l2_taxe_boissons_tabac ?? 0,       centimes: 0 },
    { num: 3,  nature: 'TVA (18%) — Taxe sur valeur ajoutée',   principal: d.l3_tva ?? 0,                       centimes: d.l3_tva_centimes ?? 0, highlight: true },
    { num: 4,  nature: 'TVA tiers (retenue à la source)',        principal: d.l4_tva_tiers ?? 0,                 centimes: d.l4_tva_tiers_centimes ?? 0 },
    { num: 5,  nature: 'Taxe sur transferts de fonds (1,5%)',    principal: d.l5_taxe_transferts_fonds ?? 0,     centimes: 0 },
    { num: 6,  nature: 'Taxe sur jeux de hasard',                principal: d.l6_taxe_jeux_hasard ?? 0,          centimes: 0 },
    { num: 7,  nature: 'IRPP — BIC/BNC',                         principal: d.l7_irpp_bic_bnc ?? 0,              centimes: 0 },
    { num: 8,  nature: `IRPP salaires (${d.l8_nb_employes ?? 0} emp. / ${n(d.l8_salaires_bruts)} bruts)`, principal: d.l8_irpp_salaires ?? 0, centimes: 0, highlight: true },
    { num: 9,  nature: `TUS 4,5% (${n(d.l9_salaires_bruts)} bruts)`, principal: d.l9_tus ?? 0,                  centimes: 0, highlight: true },
    { num: 10, nature: "IS — Impôt sur les sociétés (30%)",      principal: d.l10_is ?? 0,                       centimes: 0 },
    { num: 11, nature: 'ISF — Impôt sur les sociétés financières', principal: d.l11_isf ?? 0,                    centimes: 0 },
    { num: 12, nature: 'TSS — Taxe sur les services spéciaux',   principal: d.l12_tss ?? 0,                      centimes: 0 },
    { num: 13, nature: 'TVTS — Taxe sur véhicules de tourisme',  principal: d.l13_tvts ?? 0,                     centimes: 0 },
    { num: 14, nature: 'IRVM — Impôt sur revenus de valeurs mob.',principal: d.l14_irvm ?? 0,                    centimes: 0 },
    { num: 15, nature: 'Retenue à la source — 20%',              principal: d.l15_ras_20pct ?? 0,                centimes: 0 },
    { num: 16, nature: 'Retenue à la source — 5%',               principal: d.l16_ras_5pct ?? 0,                 centimes: 0 },
    { num: 17, nature: 'Retenue BTP',                            principal: d.l17_ras_btp ?? 0,                  centimes: 0 },
    { num: 18, nature: 'ASDI — Aide sociale',                    principal: d.l18_asdi ?? 0,                     centimes: 0 },
    { num: 19, nature: 'Taxe sur appareils',                     principal: d.l19_taxe_appareils ?? 0,           centimes: 0 },
    { num: 20, nature: 'RAV — Redevance audiovisuelle',          principal: d.l20_rav ?? 0,                      centimes: 0 },
    { num: 21, nature: 'Redevances diverses',                    principal: d.l21_redevances ?? 0,               centimes: 0 },
    { num: 22, nature: 'Taxe sur assurances',                    principal: d.l22_taxe_assurance ?? 0,           centimes: 0 },
    { num: 23, nature: 'Taxe immobilière',                       principal: d.l23_taxe_immobiliere ?? 0,         centimes: 0 },
    { num: 24, nature: 'TOL — Taxe occupation des locaux',       principal: d.l24_tol ?? 0,                      centimes: 0 },
    { num: 25, nature: 'Taxe régionale',                         principal: d.l25_taxe_regionale ?? 0,           centimes: 0 },
    { num: 26, nature: 'Contribution foncière (propriétés bâties)',  principal: d.l26_contrib_fonciere_baties ?? 0, centimes: 0 },
    { num: 27, nature: 'Contribution foncière (propriétés non bâties)', principal: d.l27_contrib_fonciere_non_baties ?? 0, centimes: 0 },
  ]
}

// ─── Document PDF ─────────────────────────────────────────────────────────────

export function DeclarationGeneralePDFDocument({ data }: { data: DGIData }) {
  const periode = `${MOIS_FR[(data.mois ?? 1) - 1]} ${data.annee}`
  const rows = lignes(data)
  const totalDroits = data.total_droits_payes ?? 0
  const lettres = montantEnLettres(totalDroits)
  const dateSign = data.date_signature
    ? new Date(data.date_signature).toLocaleDateString('fr-FR')
    : new Date().toLocaleDateString('fr-FR')

  return (
    <Document title={`Déclaration DGI — ${periode}`} author="Oraforme">
      <Page size="A4" style={S.page}>

        {/* ── EN-TÊTE ──────────────────────────────────────────────────────── */}
        <View style={S.header}>
          <View style={S.headerLeft}>
            <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 7.5 }}>
              MINISTÈRE DES FINANCES ET DU BUDGET
            </Text>
            <Text>Direction Générale des Impôts et des Domaines</Text>
            <Text>DGID — République du Congo</Text>
          </View>
          <View style={S.headerMid}>
            <Text style={S.titleMain}>DÉCLARATION GÉNÉRALE</Text>
            <Text style={S.titleMain}>DES IMPÔTS ET TAXES</Text>
            <Text style={S.titleSub}>Formulaire mensuel — DGI Congo</Text>
            <Text style={S.badge}>PÉRIODE : {periode.toUpperCase()}</Text>
          </View>
          <View style={S.headerRight}>
            <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 8 }}>RÉPUBLIQUE DU CONGO</Text>
            <Text>Unité · Travail · Progrès</Text>
            <Text style={{ marginTop: 4, color: '#DC2626', fontFamily: 'Helvetica-Bold' }}>
              Échéance : 20/{String(data.mois === 12 ? 1 : data.mois + 1).padStart(2,'0')}/{data.mois === 12 ? (data.annee ?? 0) + 1 : data.annee}
            </Text>
          </View>
        </View>

        {/* ── SECTION I : IDENTIFICATION ──────────────────────────────────── */}
        <Text style={S.sectionTitle}>Section I — Identification du contribuable</Text>
        <View style={S.row2}>
          <View style={S.field}>
            <Text style={S.label}>NIU (Numéro d'identification unique)</Text>
            <Text style={S.value}>{data.niu || '—'}</Text>
          </View>
          <View style={S.field}>
            <Text style={S.label}>Dénomination sociale</Text>
            <Text style={S.value}>{data.denomination_sociale || '—'}</Text>
          </View>
          <View style={S.field}>
            <Text style={S.label}>Résidence fiscale</Text>
            <Text style={S.value}>{data.residence_fiscale || '—'}</Text>
          </View>
        </View>
        <View style={S.row2}>
          <View style={S.field}>
            <Text style={S.label}>Adresse</Text>
            <Text style={S.value}>{data.adresse || '—'}</Text>
          </View>
          <View style={S.field}>
            <Text style={S.label}>Ville</Text>
            <Text style={S.value}>{data.ville || '—'}</Text>
          </View>
          <View style={S.field}>
            <Text style={S.label}>Téléphone</Text>
            <Text style={S.value}>{data.telephone || '—'}</Text>
          </View>
          <View style={S.field}>
            <Text style={S.label}>Email</Text>
            <Text style={S.value}>{data.email || '—'}</Text>
          </View>
        </View>

        {/* ── SECTION II : TABLEAU RÉCAPITULATIF ─────────────────────────── */}
        <Text style={S.sectionTitle}>Section II — Récapitulatif des droits et taxes</Text>

        <View style={S.table}>
          {/* Header */}
          <View style={S.thead}>
            <Text style={[S.th, S.tdNum]}>N°</Text>
            <Text style={[S.th, S.tdNature]}>Nature des impôts et taxes</Text>
            <Text style={[S.th, S.tdAmt]}>Principal</Text>
            <Text style={[S.th, S.tdAmt]}>Centimes (1)</Text>
            <Text style={[S.th, S.tdTotal]}>Total payé</Text>
          </View>

          {/* Lignes */}
          {rows.map((row, i) => {
            const total = row.principal + row.centimes
            const rowStyle = row.highlight ? S.trHighlight : i % 2 === 0 ? S.tr : S.trAlt
            return (
              <View key={row.num} style={rowStyle}>
                <Text style={[S.td, S.tdNum, { fontFamily: 'Helvetica-Bold', color: '#1E3A5F' }]}>
                  {row.num}
                </Text>
                <Text style={[S.td, S.tdNature]}>{row.nature}</Text>
                <Text style={[S.td, S.tdAmt]}>{n(row.principal)}</Text>
                <Text style={[S.td, S.tdAmt]}>{row.centimes > 0 ? n(row.centimes) : '—'}</Text>
                <Text style={[S.td, S.tdTotal, { color: total > 0 ? '#1E3A5F' : '#9CA3AF' }]}>
                  {total > 0 ? n(total) : '—'}
                </Text>
              </View>
            )
          })}

          {/* Total row */}
          <View style={S.trTotal}>
            <Text style={[S.td, S.tdNum, { color: '#fff', fontFamily: 'Helvetica-Bold' }]}> </Text>
            <Text style={[S.td, S.tdNature, { color: '#fff', fontFamily: 'Helvetica-Bold', fontSize: 8 }]}>
              TOTAL GÉNÉRAL
            </Text>
            <Text style={[S.td, S.tdAmt, { color: '#FCD34D', fontFamily: 'Helvetica-Bold' }]}>
              {n(data.total_principal)}
            </Text>
            <Text style={[S.td, S.tdAmt, { color: '#FCD34D', fontFamily: 'Helvetica-Bold' }]}>
              {n(data.total_centimes)}
            </Text>
            <Text style={[S.td, S.tdTotal, { color: '#FCD34D', fontSize: 9 }]}>
              {n(totalDroits)}
            </Text>
          </View>
        </View>

        {/* Note centimes */}
        <Text style={{ fontSize: 6, color: '#6B7280', marginTop: 3 }}>
          (1) Centimes additionnels Congo = 5% de la TVA collectée (Article CGI)
        </Text>

        {/* ── SECTION III : PAIEMENT ──────────────────────────────────────── */}
        <Text style={S.sectionTitle}>Section III — Modalités de paiement</Text>
        <View style={S.row2}>
          <View style={{ flex: 2 }}>
            <Text style={S.label}>Montant total en chiffres (FCFA)</Text>
            <Text style={[S.value, { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#DC2626' }]}>
              {n(totalDroits)} FCFA
            </Text>
          </View>
          <View style={{ flex: 3 }}>
            <Text style={S.label}>Montant en lettres</Text>
            <Text style={[S.value, { fontSize: 7 }]}>{lettres}</Text>
          </View>
        </View>
        <View style={[S.row2, { marginTop: 6, alignItems: 'center' }]}>
          <Text style={{ fontSize: 7.5, color: '#374151' }}>Mode de paiement :</Text>
          {['especes','cheque','virement'].map(mode => (
            <View key={mode} style={S.checkbox}>
              <View style={data.mode_paiement === mode ? S.boxFilled : S.box} />
              <Text style={{ fontSize: 7 }}>
                {mode === 'especes' ? 'Espèces' : mode === 'cheque' ? 'Chèque' : 'Virement'}
              </Text>
            </View>
          ))}
          {data.reference_cheque && (
            <Text style={{ fontSize: 7, color: '#374151' }}>
              Réf : {data.reference_cheque}
            </Text>
          )}
        </View>

        {/* Signature */}
        <View style={S.sigRow}>
          <View style={S.sigBox}>
            <Text style={S.sigLabel}>Fait à {data.lieu_signature || 'Brazzaville'}, le {dateSign}</Text>
            <Text style={{ fontSize: 6.5, color: '#374151' }}>Signature et cachet du déclarant</Text>
          </View>
          <View style={S.sigBox}>
            <Text style={S.sigLabel}>Cachet et visa de la DGI</Text>
            <Text style={{ fontSize: 6.5, color: '#374151' }}>Numéro d&apos;enregistrement :</Text>
          </View>
        </View>

        {/* ── FOOTER ───────────────────────────────────────────────────────── */}
        <View style={S.footer} fixed>
          <Text style={S.footerText}>
            Déclaration Générale DGI Congo · {periode} · Échéance 20 du mois suivant
          </Text>
          <Text style={S.footerText}>oraforme.com · DGID République du Congo</Text>
        </View>

      </Page>
    </Document>
  )
}
