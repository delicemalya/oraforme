/**
 * PDF A4 Portrait — Déclaration Globale CNSS Congo
 * Rendu serveur via @react-pdf/renderer renderToBuffer()
 */
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import { fmtTaux, fmtPlafond, type DeclarationCNSS } from '@/lib/declarations/cnss-congo'
import { periodeLabel, dateAujourdhuiFr, CNSS_CONGO, BRAND } from '@/lib/declarations/branding'

const fmtN = (n: number) => new Intl.NumberFormat('fr-FR').format(Math.round(n))

const s = StyleSheet.create({
  page:         { fontFamily: 'Helvetica', fontSize: 9, padding: '20mm 15mm', color: '#0F172A', backgroundColor: '#FFFFFF' },
  headerBand:   { backgroundColor: '#0F172A', padding: '8 12', marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle:  { color: '#FFFFFF', fontSize: 12, fontFamily: 'Helvetica-Bold' },
  headerSub:    { color: '#F59E0B', fontSize: 8 },
  sectionTitle: { fontSize: 10, fontFamily: 'Helvetica-Bold', backgroundColor: '#F1F5F9', padding: '5 8', marginBottom: 6, borderLeft: '3 solid #F59E0B' },
  infoGrid:     { flexDirection: 'row', gap: 20, marginBottom: 12 },
  infoBlock:    { flex: 1, border: '1 solid #E2E8F0', borderRadius: 4, padding: '6 8' },
  infoLabel:    { fontSize: 7, color: '#64748B', textTransform: 'uppercase', marginBottom: 2 },
  infoValue:    { fontSize: 9, fontFamily: 'Helvetica-Bold' },
  table:        { border: '1 solid #E2E8F0', borderRadius: 4, overflow: 'hidden', marginBottom: 12 },
  thead:        { flexDirection: 'row', backgroundColor: '#0F172A' },
  theadCell:    { color: '#FFFFFF', fontSize: 7, fontFamily: 'Helvetica-Bold', padding: '5 4', flex: 1, textAlign: 'right' },
  theadCellL:   { color: '#FFFFFF', fontSize: 7, fontFamily: 'Helvetica-Bold', padding: '5 4', flex: 2, textAlign: 'left' },
  trow:         { flexDirection: 'row', borderBottom: '0.5 solid #F1F5F9' },
  trowAlt:      { flexDirection: 'row', borderBottom: '0.5 solid #F1F5F9', backgroundColor: '#FAFAFA' },
  tcell:        { fontSize: 8, padding: '4 4', flex: 1, textAlign: 'right' },
  tcellL:       { fontSize: 8, padding: '4 4', flex: 2, textAlign: 'left' },
  totalRow:     { flexDirection: 'row', backgroundColor: '#0F172A' },
  totalCell:    { color: '#FFFFFF', fontSize: 8, fontFamily: 'Helvetica-Bold', padding: '5 4', flex: 1, textAlign: 'right' },
  totalCellL:   { color: '#FFFFFF', fontSize: 8, fontFamily: 'Helvetica-Bold', padding: '5 4', flex: 2, textAlign: 'left' },
  footer:       { borderTop: '1 solid #E2E8F0', paddingTop: 8, marginTop: 16, flexDirection: 'row', justifyContent: 'space-between' },
  footerText:   { fontSize: 7, color: '#94A3B8' },
  sigBlock:     { border: '1 solid #E2E8F0', borderRadius: 4, padding: '12 16', width: '45%', marginTop: 16 },
  sigLabel:     { fontSize: 7, color: '#64748B', marginBottom: 24 },
  totalBig:     { backgroundColor: '#FFF7ED', border: '1 solid #F59E0B', borderRadius: 6, padding: '10 14', marginBottom: 12 },
  totalBigLabel:{ fontSize: 8, color: '#92400E' },
  totalBigValue:{ fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#0F172A', marginTop: 2 },
})

interface Props {
  decl: DeclarationCNSS
  entreprise: string
  numero_cnss_employeur?: string
}

export function DeclarationGlobaleCNSS({ decl, entreprise, numero_cnss_employeur }: Props) {
  const r = decl.recap
  const periode = periodeLabel(decl.mois, decl.annee)

  // Plafonds imprimés : lus sur les branches, jamais réécrits.
  const plafondDe = (code: string) =>
    fmtPlafond(r.branches.find(b => b.code === code)?.plafond_mensuel ?? null)
  const plafondVieillesse = plafondDe('VID_PAT')
  const plafondAF         = plafondDe('AF')
  const plafondAT         = plafondDe('AT')

  // Une ligne par branche cotisée, telle que le moteur fiscal la fournit.
  // Aucun taux ni plafond n'est écrit ici : le document imprimait 10,03 % sur
  // une base plafonnée à 600 000 F alors que les allocations familiales ont
  // leur propre plafond de 1 200 000 F.
  const lignes = r.branches
    .filter(b => b.montant_salarie > 0 || b.montant_patronal > 0)
    .flatMap(b => {
      const out: Array<{ label: string; base: string; taux: string; montant: number }> = []
      if (b.taux_salarie > 0) {
        out.push({
          label:   `${b.libelle} — part salarié`,
          base:    fmtN(b.base_totale),
          taux:    fmtTaux(b.taux_salarie),
          montant: b.montant_salarie,
        })
      }
      if (b.taux_patronal > 0) {
        out.push({
          label:   `${b.libelle} — part patronale`,
          base:    fmtN(b.base_totale),
          taux:    fmtTaux(b.taux_patronal),
          montant: b.montant_patronal,
        })
      }
      return out
    })

  return (
    <Document title={`Déclaration CNSS — ${periode}`} author="Oraforme ERP">
      <Page size="A4" orientation="portrait" style={s.page}>

        {/* En-tête */}
        <View style={s.headerBand}>
          <View>
            <Text style={s.headerTitle}>{CNSS_CONGO.organisme}</Text>
            <Text style={s.headerSub}>{CNSS_CONGO.pays}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ color: '#F59E0B', fontSize: 10, fontFamily: 'Helvetica-Bold' }}>
              DÉCLARATION GLOBALE DES COTISATIONS
            </Text>
            <Text style={{ color: '#CBD5E1', fontSize: 8 }}>Période : {periode}</Text>
          </View>
        </View>

        {/* Infos employeur */}
        <View style={s.infoGrid}>
          <View style={s.infoBlock}>
            <Text style={s.infoLabel}>Employeur</Text>
            <Text style={s.infoValue}>{entreprise}</Text>
          </View>
          <View style={s.infoBlock}>
            <Text style={s.infoLabel}>N° Immatriculation CNSS</Text>
            <Text style={s.infoValue}>{numero_cnss_employeur || 'À compléter'}</Text>
          </View>
          <View style={s.infoBlock}>
            <Text style={s.infoLabel}>Période de déclaration</Text>
            <Text style={s.infoValue}>{periode}</Text>
          </View>
          <View style={s.infoBlock}>
            <Text style={s.infoLabel}>Nombre d&#39;employés</Text>
            <Text style={s.infoValue}>{r.nb_employes}</Text>
          </View>
        </View>

        {/* Masse salariale */}
        <View style={s.sectionTitle}><Text>MASSE SALARIALE</Text></View>
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
          <View style={[s.infoBlock, { flex: 1 }]}>
            <Text style={s.infoLabel}>Masse salariale brute totale</Text>
            <Text style={[s.infoValue, { fontSize: 13 }]}>{fmtN(r.masse_salariale)} FCFA</Text>
          </View>
          <View style={[s.infoBlock, { flex: 1 }]}>
            <Text style={s.infoLabel}>Base vieillesse (plaf. {plafondVieillesse}/agent)</Text>
            <Text style={s.infoValue}>{fmtN(r.base_vieillesse_total)} FCFA</Text>
          </View>
          <View style={[s.infoBlock, { flex: 1 }]}>
            <Text style={s.infoLabel}>Base allocations familiales (plaf. {plafondAF}/agent)</Text>
            <Text style={s.infoValue}>{fmtN(r.base_allocations_familiales_total)} FCFA</Text>
          </View>
          <View style={[s.infoBlock, { flex: 1 }]}>
            <Text style={s.infoLabel}>Base accidents du travail (plaf. {plafondAT}/agent)</Text>
            <Text style={s.infoValue}>{fmtN(r.base_at_mp_pf_total)} FCFA</Text>
          </View>
        </View>

        {/* Tableau des cotisations */}
        <View style={s.sectionTitle}><Text>DÉTAIL DES COTISATIONS</Text></View>
        <View style={s.table}>
          <View style={s.thead}>
            <Text style={[s.theadCellL, { flex: 3 }]}>Nature de la cotisation</Text>
            <Text style={s.theadCell}>Base de calcul</Text>
            <Text style={s.theadCell}>Taux</Text>
            <Text style={s.theadCell}>Montant (FCFA)</Text>
          </View>
          {lignes.map((l, i) => (
            <View key={i} style={i % 2 === 0 ? s.trow : s.trowAlt}>
              <Text style={[s.tcellL, { flex: 3 }]}>{l.label}</Text>
              <Text style={s.tcell}>{l.base}</Text>
              <Text style={s.tcell}>{l.taux}</Text>
              <Text style={[s.tcell, { fontFamily: 'Helvetica-Bold' }]}>{fmtN(l.montant)}</Text>
            </View>
          ))}
          <View style={s.totalRow}>
            <Text style={[s.totalCellL, { flex: 3 }]}>TOTAL COTISATIONS SALARIALES (part agent)</Text>
            <Text style={s.totalCell}></Text>
            <Text style={s.totalCell}></Text>
            <Text style={s.totalCell}>{fmtN(r.cotisation_vieillesse_employe)}</Text>
          </View>
          <View style={[s.totalRow, { backgroundColor: '#1E293B' }]}>
            <Text style={[s.totalCellL, { flex: 3 }]}>TOTAL COTISATIONS PATRONALES</Text>
            <Text style={s.totalCell}></Text>
            <Text style={s.totalCell}></Text>
            <Text style={s.totalCell}>{fmtN(r.total_cotisations_patronales)}</Text>
          </View>
        </View>

        {/* Total à verser */}
        <View style={s.totalBig}>
          <Text style={s.totalBigLabel}>TOTAL À VERSER À LA CNSS</Text>
          <Text style={s.totalBigValue}>{fmtN(r.total_a_verser)} FCFA</Text>
          <Text style={[s.totalBigLabel, { marginTop: 4 }]}>
            dont : part salarié {fmtN(r.cotisation_vieillesse_employe)} + part patronal {fmtN(r.total_cotisations_patronales)} FCFA
          </Text>
        </View>

        {/* Bloc signatures */}
        <View style={{ flexDirection: 'row', gap: 20, marginTop: 8 }}>
          <View style={s.sigBlock}>
            <Text style={s.sigLabel}>Cachet et signature de l&#39;employeur</Text>
            <View style={{ borderBottom: '1 solid #CBD5E1', marginTop: 16 }} />
            <Text style={[s.sigLabel, { marginTop: 6 }]}>Date : ____/____/________</Text>
          </View>
          <View style={s.sigBlock}>
            <Text style={s.sigLabel}>Réservé à la CNSS</Text>
            <Text style={[s.sigLabel, { marginTop: 4 }]}>Date de réception : ____/____/________</Text>
            <Text style={[s.sigLabel, { marginTop: 4 }]}>Référence bordereau : ________________</Text>
          </View>
        </View>

        {/* Pied de page */}
        <View style={s.footer}>
          <Text style={s.footerText}>{CNSS_CONGO.note_legale}</Text>
          <Text style={s.footerText}>Généré par {BRAND.nom} — {dateAujourdhuiFr()}</Text>
        </View>

      </Page>
    </Document>
  )
}
