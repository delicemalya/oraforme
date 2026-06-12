import React from 'react'
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

const S = StyleSheet.create({
  page: { fontFamily: 'Helvetica', fontSize: 10, padding: 40, backgroundColor: '#FFFFFF' },
  header: { marginBottom: 24, borderBottomWidth: 2, borderBottomColor: '#DC2626', paddingBottom: 16 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between' },
  cliniqueName: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#0F172A' },
  cliniqueInfo: { fontSize: 8, color: '#64748B', marginTop: 2 },
  facTitle: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#DC2626', textAlign: 'right' },
  facNum: { fontSize: 10, color: '#64748B', textAlign: 'right', marginTop: 2 },
  facDate: { fontSize: 9, color: '#64748B', textAlign: 'right' },
  twoCol: { flexDirection: 'row', gap: 16, marginBottom: 20 },
  infoBox: { flex: 1, backgroundColor: '#F8FAFC', borderRadius: 4, padding: 10 },
  infoBoxTitle: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
  infoRow: { flexDirection: 'row', marginBottom: 3 },
  infoLabel: { fontSize: 8, color: '#64748B', width: 70 },
  infoValue: { fontSize: 8, color: '#0F172A', fontFamily: 'Helvetica-Bold', flex: 1 },
  tableHeader: { flexDirection: 'row', backgroundColor: '#0F172A', padding: 8, marginBottom: 0 },
  thText: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#FFFFFF' },
  tableRow: { flexDirection: 'row', padding: 8, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  tableRowAlt: { backgroundColor: '#F8FAFC' },
  tdText: { fontSize: 9, color: '#374151' },
  colDesc: { flex: 3 },
  colQte: { flex: 1, textAlign: 'center' },
  colPrix: { flex: 1, textAlign: 'right' },
  colTotal: { flex: 1, textAlign: 'right' },
  colCat: { flex: 1.5, textAlign: 'center' },
  totalsBox: { marginTop: 16, alignItems: 'flex-end' },
  totalRow: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 4, minWidth: 200 },
  totalLabel: { fontSize: 9, color: '#64748B', width: 100, textAlign: 'right' },
  totalValue: { fontSize: 9, color: '#0F172A', fontFamily: 'Helvetica-Bold', width: 80, textAlign: 'right' },
  totalFinalRow: { flexDirection: 'row', justifyContent: 'flex-end', backgroundColor: '#DC2626', padding: 8, borderRadius: 4, minWidth: 200, marginTop: 4 },
  totalFinalLabel: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#FFFFFF', flex: 1 },
  totalFinalValue: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#FFFFFF', width: 80, textAlign: 'right' },
  paymentBox: { backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#BBF7D0', borderRadius: 4, padding: 10, marginTop: 12 },
  paymentTitle: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#16A34A', marginBottom: 4 },
  paymentText: { fontSize: 9, color: '#374151' },
  statutBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  notes: { marginTop: 16, backgroundColor: '#F8FAFC', padding: 10, borderRadius: 4 },
  notesTitle: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#64748B', marginBottom: 4 },
  notesText: { fontSize: 9, color: '#374151' },
  footer: { position: 'absolute', bottom: 24, left: 40, right: 40, borderTopWidth: 1, borderTopColor: '#E5E7EB', paddingTop: 8, flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { fontSize: 7, color: '#94A3B8' },
})

export interface FactureMedicalePDFData {
  numero_facture: string
  date_facture: string
  date_echeance: string | null
  montant_total: number
  montant_paye: number
  remise: number
  mode_paiement: string | null
  statut: string
  notes: string | null
  // Patient
  patient_nom: string
  patient_prenom: string
  patient_telephone: string | null
  patient_numero_dossier: string | null
  patient_assurance: string | null
  // Clinique
  clinique_nom: string
  clinique_adresse: string | null
  clinique_telephone: string | null
  clinique_ville: string
  clinique_niu: string | null
  // Lignes
  lignes: {
    description: string
    quantite: number
    prix_unitaire: number
    montant_ligne: number
    categorie: string
  }[]
}

const CAT_LABEL: Record<string, string> = {
  consultation: 'Consultation', hospitalisation: 'Hospitalisation',
  pharmacie: 'Pharmacie', labo: 'Labo', imagerie: 'Imagerie',
  bloc: 'Bloc opératoire', autre: 'Divers',
}
const STATUT_LABEL: Record<string, { label: string; color: string }> = {
  en_attente: { label: 'EN ATTENTE', color: '#D97706' },
  partielle:  { label: 'PARTIELLE',  color: '#7C3AED' },
  payee:      { label: 'PAYÉE',      color: '#16A34A' },
  annulee:    { label: 'ANNULÉE',    color: '#DC2626' },
}
const PAIE_LABEL: Record<string, string> = {
  especes: 'Espèces', mobile_money: 'Mobile Money', carte: 'Carte bancaire',
  assurance: 'Assurance', credit: 'Crédit', mixte: 'Paiement mixte',
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
}
function fmtFCFA(n: number) {
  return `${new Intl.NumberFormat('fr-FR').format(Math.round(n))} FCFA`
}

export function FactureMedicalePDFDocument({ data }: { data: FactureMedicalePDFData }) {
  const montantRestant = data.montant_total - data.montant_paye - (data.remise ?? 0)
  const statut = STATUT_LABEL[data.statut] ?? STATUT_LABEL.en_attente

  return (
    <Document title={`Facture ${data.numero_facture}`}>
      <Page size="A4" style={S.page}>

        {/* En-tête */}
        <View style={S.header}>
          <View style={S.headerRow}>
            <View>
              <Text style={S.cliniqueName}>{data.clinique_nom}</Text>
              {data.clinique_adresse && <Text style={S.cliniqueInfo}>{data.clinique_adresse}</Text>}
              <Text style={S.cliniqueInfo}>{data.clinique_ville}{data.clinique_telephone ? ` · Tél: ${data.clinique_telephone}` : ''}</Text>
              {data.clinique_niu && <Text style={S.cliniqueInfo}>NIU: {data.clinique_niu}</Text>}
            </View>
            <View>
              <Text style={S.facTitle}>FACTURE</Text>
              <Text style={S.facNum}>{data.numero_facture}</Text>
              <Text style={S.facDate}>Date : {fmtDate(data.date_facture)}</Text>
              {data.date_echeance && <Text style={S.facDate}>Échéance : {fmtDate(data.date_echeance)}</Text>}
              <View style={[S.statutBadge, { marginTop: 4, backgroundColor: `${statut.color}18` }]}>
                <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: statut.color, textAlign: 'right' }}>{statut.label}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Patient info */}
        <View style={S.twoCol}>
          <View style={S.infoBox}>
            <Text style={S.infoBoxTitle}>Patient</Text>
            <View style={S.infoRow}><Text style={S.infoLabel}>Nom :</Text><Text style={S.infoValue}>{data.patient_prenom} {data.patient_nom}</Text></View>
            {data.patient_numero_dossier && <View style={S.infoRow}><Text style={S.infoLabel}>N° Dossier :</Text><Text style={S.infoValue}>{data.patient_numero_dossier}</Text></View>}
            {data.patient_telephone && <View style={S.infoRow}><Text style={S.infoLabel}>Téléphone :</Text><Text style={S.infoValue}>{data.patient_telephone}</Text></View>}
            {data.patient_assurance && <View style={S.infoRow}><Text style={S.infoLabel}>Assurance :</Text><Text style={S.infoValue}>{data.patient_assurance}</Text></View>}
          </View>
          <View style={S.infoBox}>
            <Text style={S.infoBoxTitle}>Établissement</Text>
            <View style={S.infoRow}><Text style={S.infoLabel}>Clinique :</Text><Text style={S.infoValue}>{data.clinique_nom}</Text></View>
            <View style={S.infoRow}><Text style={S.infoLabel}>Ville :</Text><Text style={S.infoValue}>{data.clinique_ville}</Text></View>
            {data.clinique_niu && <View style={S.infoRow}><Text style={S.infoLabel}>NIU :</Text><Text style={S.infoValue}>{data.clinique_niu}</Text></View>}
          </View>
        </View>

        {/* Tableau lignes */}
        <View style={S.tableHeader}>
          <Text style={[S.thText, S.colDesc]}>Description</Text>
          <Text style={[S.thText, S.colCat]}>Catégorie</Text>
          <Text style={[S.thText, S.colQte]}>Qté</Text>
          <Text style={[S.thText, S.colPrix]}>Prix unit.</Text>
          <Text style={[S.thText, S.colTotal]}>Total</Text>
        </View>
        {data.lignes.map((l, i) => (
          <View key={i} style={[S.tableRow, i % 2 === 1 ? S.tableRowAlt : {}]}>
            <Text style={[S.tdText, S.colDesc]}>{l.description}</Text>
            <Text style={[S.tdText, S.colCat, { color: '#64748B', fontSize: 8 }]}>{CAT_LABEL[l.categorie] ?? l.categorie}</Text>
            <Text style={[S.tdText, S.colQte]}>{l.quantite}</Text>
            <Text style={[S.tdText, S.colPrix]}>{fmtFCFA(l.prix_unitaire)}</Text>
            <Text style={[S.tdText, S.colTotal, { fontFamily: 'Helvetica-Bold' }]}>{fmtFCFA(l.montant_ligne)}</Text>
          </View>
        ))}

        {/* Totaux */}
        <View style={S.totalsBox}>
          <View style={S.totalRow}>
            <Text style={S.totalLabel}>Sous-total :</Text>
            <Text style={S.totalValue}>{fmtFCFA(data.montant_total)}</Text>
          </View>
          {(data.remise ?? 0) > 0 && (
            <View style={S.totalRow}>
              <Text style={S.totalLabel}>Remise :</Text>
              <Text style={[S.totalValue, { color: '#16A34A' }]}>- {fmtFCFA(data.remise)}</Text>
            </View>
          )}
          {data.montant_paye > 0 && (
            <View style={S.totalRow}>
              <Text style={S.totalLabel}>Déjà payé :</Text>
              <Text style={[S.totalValue, { color: '#16A34A' }]}>- {fmtFCFA(data.montant_paye)}</Text>
            </View>
          )}
          <View style={S.totalFinalRow}>
            <Text style={S.totalFinalLabel}>SOLDE DÛ</Text>
            <Text style={S.totalFinalValue}>{fmtFCFA(Math.max(0, montantRestant))}</Text>
          </View>
        </View>

        {/* Paiement */}
        {data.mode_paiement && (
          <View style={S.paymentBox}>
            <Text style={S.paymentTitle}>Mode de règlement</Text>
            <Text style={S.paymentText}>{PAIE_LABEL[data.mode_paiement] ?? data.mode_paiement}</Text>
          </View>
        )}

        {/* Notes */}
        {data.notes && (
          <View style={S.notes}>
            <Text style={S.notesTitle}>Notes</Text>
            <Text style={S.notesText}>{data.notes}</Text>
          </View>
        )}

        {/* Footer */}
        <View style={S.footer} fixed>
          <Text style={S.footerText}>{data.clinique_nom} · {data.clinique_ville}</Text>
          <Text style={S.footerText}>Facture {data.numero_facture} · {fmtDate(data.date_facture)}</Text>
        </View>

      </Page>
    </Document>
  )
}
