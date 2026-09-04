/**
 * PDF A4 Paysage — Liste Nominative CNSS Congo
 * Rendu serveur via @react-pdf/renderer renderToBuffer()
 */
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import { fmtPlafond, type DeclarationCNSS } from '@/lib/declarations/cnss-congo'
import { periodeLabel, dateAujourdhuiFr, CNSS_CONGO, BRAND } from '@/lib/declarations/branding'

const fmtN = (n: number) => new Intl.NumberFormat('fr-FR').format(Math.round(n))

const s = StyleSheet.create({
  page:      { fontFamily: 'Helvetica', fontSize: 7.5, padding: '14mm 12mm', color: '#0F172A', backgroundColor: '#FFFFFF' },
  topBand:   { backgroundColor: '#0F172A', padding: '6 10', marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  topTitle:  { color: '#FFFFFF', fontSize: 10, fontFamily: 'Helvetica-Bold' },
  topSub:    { color: '#F59E0B', fontSize: 7 },
  infoRow:   { flexDirection: 'row', gap: 12, marginBottom: 8 },
  infoBlock: { flex: 1, border: '0.5 solid #E2E8F0', borderRadius: 3, padding: '4 6' },
  iLabel:    { fontSize: 6, color: '#94A3B8', textTransform: 'uppercase', marginBottom: 1 },
  iValue:    { fontSize: 7.5, fontFamily: 'Helvetica-Bold' },
  table:     { border: '0.5 solid #E2E8F0', borderRadius: 3, overflow: 'hidden' },
  thead:     { flexDirection: 'row', backgroundColor: '#0F172A' },
  th:        { color: '#FFFFFF', fontSize: 6, fontFamily: 'Helvetica-Bold', padding: '4 3', textAlign: 'right' },
  thL:       { color: '#FFFFFF', fontSize: 6, fontFamily: 'Helvetica-Bold', padding: '4 3', textAlign: 'left' },
  subhead:   { flexDirection: 'row', backgroundColor: '#1E293B' },
  sth:       { color: '#94A3B8', fontSize: 5.5, padding: '2 3', textAlign: 'right', fontFamily: 'Helvetica-Bold' },
  sthL:      { color: '#94A3B8', fontSize: 5.5, padding: '2 3', textAlign: 'left' },
  trow:      { flexDirection: 'row', borderBottom: '0.3 solid #F1F5F9' },
  trowAlt:   { flexDirection: 'row', borderBottom: '0.3 solid #F1F5F9', backgroundColor: '#FAFAFA' },
  td:        { fontSize: 7, padding: '3 3', textAlign: 'right' },
  tdL:       { fontSize: 7, padding: '3 3', textAlign: 'left' },
  totRow:    { flexDirection: 'row', backgroundColor: '#F59E0B' },
  tot:       { fontSize: 7, fontFamily: 'Helvetica-Bold', padding: '4 3', textAlign: 'right', color: '#0F172A' },
  totL:      { fontSize: 7, fontFamily: 'Helvetica-Bold', padding: '4 3', textAlign: 'left', color: '#0F172A' },
  footer:    { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, borderTop: '0.5 solid #E2E8F0', paddingTop: 5 },
  fText:     { fontSize: 6, color: '#94A3B8' },
})

// Largeurs relatives (sur 100%)
const W = {
  n:     1.5,
  nom:   7,
  cnss:  4.5,
  brut:  5,
  bvie:  5,
  ce:    4.5,
  vie:   4.5,
  bat:   5,
  af:    4.5,
  at:    4,
  tus:   4,
  totP:  5,
  totA:  5,
}

interface Props {
  decl: DeclarationCNSS
  entreprise: string
  numero_cnss_employeur?: string
}

export function ListeNominativeCNSS({ decl, entreprise, numero_cnss_employeur }: Props) {
  const r = decl.recap

  // Plafonds imprimés en pied de page : lus sur les branches du moteur fiscal.
  // La mention précédente annonçait « Plafond AF/AT/MP : 600 000 » alors que
  // les allocations familiales sont plafonnées à 1 200 000 F.
  const piedPlafonds = r.branches
    .map(b => `${b.libelle} : ${fmtPlafond(b.plafond_mensuel)}`)
    .join(' · ')
  const periode = periodeLabel(decl.mois, decl.annee)

  return (
    <Document title={`Liste Nominative CNSS — ${periode}`} author="Oraforme ERP">
      <Page size="A4" orientation="landscape" style={s.page}>

        {/* En-tête */}
        <View style={s.topBand}>
          <View>
            <Text style={s.topTitle}>{CNSS_CONGO.organisme}</Text>
            <Text style={s.topSub}>LISTE NOMINATIVE DES SALARIÉS — {CNSS_CONGO.pays}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ color: '#F59E0B', fontSize: 9, fontFamily: 'Helvetica-Bold' }}>Période : {periode}</Text>
            <Text style={{ color: '#CBD5E1', fontSize: 7 }}>{r.nb_employes} employé{r.nb_employes > 1 ? 's' : ''}</Text>
          </View>
        </View>

        {/* Infos */}
        <View style={s.infoRow}>
          <View style={s.infoBlock}>
            <Text style={s.iLabel}>Employeur</Text>
            <Text style={s.iValue}>{entreprise}</Text>
          </View>
          <View style={s.infoBlock}>
            <Text style={s.iLabel}>N° Immatriculation CNSS</Text>
            <Text style={s.iValue}>{numero_cnss_employeur || 'À compléter'}</Text>
          </View>
          <View style={s.infoBlock}>
            <Text style={s.iLabel}>Masse salariale brute</Text>
            <Text style={s.iValue}>{fmtN(r.masse_salariale)} FCFA</Text>
          </View>
          <View style={s.infoBlock}>
            <Text style={s.iLabel}>Total à verser CNSS</Text>
            <Text style={[s.iValue, { color: '#D97706' }]}>{fmtN(r.total_a_verser)} FCFA</Text>
          </View>
        </View>

        {/* Tableau */}
        <View style={s.table}>
          {/* Entête principale */}
          <View style={s.thead}>
            <Text style={[s.thL, { flex: W.n }]}>N°</Text>
            <Text style={[s.thL, { flex: W.nom }]}>Nom, Post-nom, Prénom</Text>
            <Text style={[s.th, { flex: W.cnss }]}>N° CNSS</Text>
            <Text style={[s.th, { flex: W.brut }]}>Sal. Brut</Text>
            {/* Vieillesse */}
            <Text style={[s.th, { flex: W.bvie }]}>Base Vieill.</Text>
            <Text style={[s.th, { flex: W.ce }]}>Part Agent 4%</Text>
            <Text style={[s.th, { flex: W.vie }]}>VID 8%</Text>
            {/* AT/AF */}
            <Text style={[s.th, { flex: W.bat }]}>Base AT/AF</Text>
            <Text style={[s.th, { flex: W.af }]}>AF 10.03%</Text>
            <Text style={[s.th, { flex: W.at }]}>AT 2.25%</Text>
            {/* TUS */}
            <Text style={[s.th, { flex: W.tus }]}>TUS 3%</Text>
            {/* Totaux */}
            <Text style={[s.th, { flex: W.totP }]}>Tot. Patron.</Text>
            <Text style={[s.th, { flex: W.totA }]}>Tot. à Verser</Text>
          </View>

          {/* Lignes */}
          {decl.employes.map((e, i) => {
            const nomComplet = [e.nom, e.postnom, e.prenom].filter(Boolean).join(' ')
            const Row = i % 2 === 0 ? s.trow : s.trowAlt
            return (
              <View key={e.employe_id ?? i} style={Row}>
                <Text style={[s.tdL, { flex: W.n }]}>{e.numero_ordre}</Text>
                <Text style={[s.tdL, { flex: W.nom }]}>{nomComplet}</Text>
                <Text style={[s.td, { flex: W.cnss }]}>{e.numero_cnss}</Text>
                <Text style={[s.td, { flex: W.brut, fontFamily: 'Helvetica-Bold' }]}>{fmtN(e.salaire_brut)}</Text>
                <Text style={[s.td, { flex: W.bvie }]}>{fmtN(e.base_vieillesse)}</Text>
                <Text style={[s.td, { flex: W.ce, color: '#7C3AED' }]}>{fmtN(e.cotisation_employe)}</Text>
                <Text style={[s.td, { flex: W.vie, color: '#1D4ED8' }]}>{fmtN(e.cotisation_vieillesse)}</Text>
                <Text style={[s.td, { flex: W.bat }]}>{fmtN(e.base_at_mp_pf)}</Text>
                <Text style={[s.td, { flex: W.af }]}>{fmtN(e.allocations_familiales)}</Text>
                <Text style={[s.td, { flex: W.at }]}>{fmtN(e.accidents_travail)}</Text>
                <Text style={[s.td, { flex: W.tus, color: '#B45309' }]}>{fmtN(e.cotisation_tus)}</Text>
                <Text style={[s.td, { flex: W.totP, fontFamily: 'Helvetica-Bold' }]}>{fmtN(e.total_patronal)}</Text>
                <Text style={[s.td, { flex: W.totA, fontFamily: 'Helvetica-Bold', color: '#DC2626' }]}>{fmtN(e.total_a_verser)}</Text>
              </View>
            )
          })}

          {/* Ligne totaux */}
          <View style={s.totRow}>
            <Text style={[s.totL, { flex: W.n }]}></Text>
            <Text style={[s.totL, { flex: W.nom }]}>TOTAUX ({r.nb_employes} employé{r.nb_employes > 1 ? 's' : ''})</Text>
            <Text style={[s.tot, { flex: W.cnss }]}></Text>
            <Text style={[s.tot, { flex: W.brut }]}>{fmtN(r.masse_salariale)}</Text>
            <Text style={[s.tot, { flex: W.bvie }]}>{fmtN(r.base_vieillesse_total)}</Text>
            <Text style={[s.tot, { flex: W.ce }]}>{fmtN(r.cotisation_vieillesse_employe)}</Text>
            <Text style={[s.tot, { flex: W.vie }]}>{fmtN(r.cotisation_vieillesse_patronal)}</Text>
            <Text style={[s.tot, { flex: W.bat }]}>{fmtN(r.base_at_mp_pf_total)}</Text>
            <Text style={[s.tot, { flex: W.af }]}>{fmtN(r.allocations_familiales_total)}</Text>
            <Text style={[s.tot, { flex: W.at }]}>{fmtN(r.accidents_travail_total)}</Text>
            <Text style={[s.tot, { flex: W.tus }]}>{fmtN(r.cotisation_tus_total)}</Text>
            <Text style={[s.tot, { flex: W.totP }]}>{fmtN(r.total_cotisations_patronales)}</Text>
            <Text style={[s.tot, { flex: W.totA }]}>{fmtN(r.total_a_verser)}</Text>
          </View>
        </View>

        {/* Plafonds note */}
        <View style={{ flexDirection: 'row', gap: 20, marginTop: 8 }}>
          <Text style={{ fontSize: 6, color: '#64748B', flex: 1 }}>
            {piedPlafonds}
          </Text>
          <Text style={{ fontSize: 6, color: '#64748B' }}>
            Signature employeur : ___________________________
          </Text>
        </View>

        {/* Pied de page */}
        <View style={s.footer}>
          <Text style={s.fText}>{CNSS_CONGO.note_legale}</Text>
          <Text style={s.fText}>Généré par {BRAND.nom} — {dateAujourdhuiFr()}</Text>
        </View>

      </Page>
    </Document>
  )
}
