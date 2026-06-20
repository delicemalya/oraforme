import React from 'react'
import {
  Document, Page, Text, View, StyleSheet,
} from '@react-pdf/renderer'

// Use safe built-in fonts only
const S = StyleSheet.create({
  page: { fontFamily: 'Helvetica', fontSize: 10, padding: 40, backgroundColor: '#FFFFFF' },
  header: { marginBottom: 24, borderBottomWidth: 2, borderBottomColor: '#DC2626', paddingBottom: 16 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cliniqueName: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#0F172A' },
  cliniqueInfo: { fontSize: 8, color: '#64748B', marginTop: 2 },
  ordoTitle: { fontSize: 22, fontFamily: 'Helvetica-Bold', color: '#DC2626', textAlign: 'right' },
  ordoNum: { fontSize: 10, color: '#64748B', textAlign: 'right', marginTop: 2 },
  ordoDate: { fontSize: 9, color: '#64748B', textAlign: 'right' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#64748B', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  infoRow: { flexDirection: 'row', marginBottom: 4 },
  infoLabel: { fontSize: 9, color: '#64748B', width: 100 },
  infoValue: { fontSize: 9, color: '#0F172A', fontFamily: 'Helvetica-Bold', flex: 1 },
  allergieBanner: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FCA5A5', borderRadius: 4, padding: 8, marginBottom: 12, flexDirection: 'row', gap: 6 },
  allergieText: { fontSize: 9, color: '#DC2626', fontFamily: 'Helvetica-Bold' },
  diagBox: { backgroundColor: '#F8FAFC', borderRadius: 4, padding: 10, marginBottom: 12 },
  diagText: { fontSize: 9, color: '#374151' },
  ligneBox: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 4, padding: 10, marginBottom: 8 },
  ligneNum: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#DC2626', marginBottom: 4 },
  ligneMed: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#0F172A', marginBottom: 2 },
  ligneDetail: { fontSize: 9, color: '#374151' },
  ligneQte: { fontSize: 9, color: '#64748B', marginTop: 2 },
  signatureBox: { marginTop: 32, borderTopWidth: 1, borderTopColor: '#E5E7EB', paddingTop: 16, flexDirection: 'row', justifyContent: 'space-between' },
  signatureLabel: { fontSize: 9, color: '#64748B' },
  signatureLine: { borderTopWidth: 1, borderTopColor: '#0F172A', width: 140, marginTop: 32, marginBottom: 4 },
  footer: { position: 'absolute', bottom: 24, left: 40, right: 40, borderTopWidth: 1, borderTopColor: '#E5E7EB', paddingTop: 8, flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { fontSize: 7, color: '#94A3B8' },
  validiteBox: { backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#BBF7D0', borderRadius: 4, padding: 6, marginTop: 8 },
  validiteText: { fontSize: 8, color: '#16A34A' },
})

export interface OrdonnancePDFData {
  numero: string
  date_prescription: string
  validite_jours: number
  diagnostic: string | null
  instructions: string | null
  // Patient
  patient_nom: string
  patient_prenom: string
  patient_dob: string | null
  patient_sexe: string | null
  patient_groupe_sanguin: string | null
  patient_allergies: string | null
  patient_numero_dossier: string | null
  // Médecin
  medecin_nom: string
  medecin_prenom: string
  medecin_specialite: string | null
  // Clinique
  clinique_nom: string
  clinique_adresse: string | null
  clinique_telephone: string | null
  clinique_ville: string
  // Lignes
  lignes: {
    ordre: number
    nom_medicament: string
    dosage: string | null
    posologie: string
    duree_jours: number | null
    quantite: number
    instructions: string | null
  }[]
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
}

export function OrdonnancePDFDocument({ data }: { data: OrdonnancePDFData }) {
  const expDate = new Date(data.date_prescription)
  expDate.setDate(expDate.getDate() + data.validite_jours)

  return (
    <Document title={`Ordonnance ${data.numero}`} author={`Dr ${data.medecin_prenom} ${data.medecin_nom}`}>
      <Page size="A4" style={S.page}>

        {/* En-tête */}
        <View style={S.header}>
          <View style={S.headerRow}>
            <View>
              <Text style={S.cliniqueName}>{data.clinique_nom}</Text>
              {data.clinique_adresse && <Text style={S.cliniqueInfo}>{data.clinique_adresse}</Text>}
              <Text style={S.cliniqueInfo}>{data.clinique_ville}{data.clinique_telephone ? ` · Tél: ${data.clinique_telephone}` : ''}</Text>
            </View>
            <View>
              <Text style={S.ordoTitle}>ORDONNANCE</Text>
              <Text style={S.ordoNum}>{data.numero}</Text>
              <Text style={S.ordoDate}>Du {fmtDate(data.date_prescription)}</Text>
            </View>
          </View>
        </View>

        {/* Médecin prescripteur */}
        <View style={S.section}>
          <Text style={S.sectionTitle}>Médecin prescripteur</Text>
          <View style={S.infoRow}>
            <Text style={S.infoLabel}>Nom :</Text>
            <Text style={S.infoValue}>Dr {data.medecin_prenom} {data.medecin_nom}</Text>
          </View>
          {data.medecin_specialite && (
            <View style={S.infoRow}>
              <Text style={S.infoLabel}>Spécialité :</Text>
              <Text style={S.infoValue}>{data.medecin_specialite}</Text>
            </View>
          )}
        </View>

        {/* Patient */}
        <View style={S.section}>
          <Text style={S.sectionTitle}>Patient</Text>
          <View style={S.infoRow}>
            <Text style={S.infoLabel}>Nom complet :</Text>
            <Text style={S.infoValue}>{data.patient_prenom} {data.patient_nom}</Text>
          </View>
          {data.patient_dob && (
            <View style={S.infoRow}>
              <Text style={S.infoLabel}>Date de naissance :</Text>
              <Text style={S.infoValue}>{fmtDate(data.patient_dob)}</Text>
            </View>
          )}
          {data.patient_sexe && (
            <View style={S.infoRow}>
              <Text style={S.infoLabel}>Sexe :</Text>
              <Text style={S.infoValue}>{data.patient_sexe === 'M' ? 'Masculin' : 'Féminin'}</Text>
            </View>
          )}
          {data.patient_groupe_sanguin && (
            <View style={S.infoRow}>
              <Text style={S.infoLabel}>Groupe sanguin :</Text>
              <Text style={S.infoValue}>{data.patient_groupe_sanguin}</Text>
            </View>
          )}
          {data.patient_numero_dossier && (
            <View style={S.infoRow}>
              <Text style={S.infoLabel}>N° dossier :</Text>
              <Text style={S.infoValue}>{data.patient_numero_dossier}</Text>
            </View>
          )}
        </View>

        {/* Alerte allergie */}
        {data.patient_allergies && (
          <View style={S.allergieBanner}>
            <Text style={S.allergieText}>⚠ ALLERGIE(S) CONNUE(S) : {data.patient_allergies}</Text>
          </View>
        )}

        {/* Diagnostic */}
        {data.diagnostic && (
          <View style={[S.section, { marginBottom: 12 }]}>
            <Text style={S.sectionTitle}>Diagnostic</Text>
            <View style={S.diagBox}>
              <Text style={S.diagText}>{data.diagnostic}</Text>
            </View>
          </View>
        )}

        {/* Médicaments */}
        <View style={S.section}>
          <Text style={S.sectionTitle}>Prescriptions médicamenteuses</Text>
          {data.lignes.map((l, i) => (
            <View key={i} style={S.ligneBox}>
              <Text style={S.ligneNum}>Rx {l.ordre}</Text>
              <Text style={S.ligneMed}>{l.nom_medicament}{l.dosage ? ` — ${l.dosage}` : ''}</Text>
              <Text style={S.ligneDetail}>Posologie : {l.posologie}</Text>
              <Text style={S.ligneQte}>
                {l.duree_jours ? `Durée : ${l.duree_jours} jours  ` : ''}
                Quantité : {l.quantite}
                {l.instructions ? `  |  ${l.instructions}` : ''}
              </Text>
            </View>
          ))}
        </View>

        {/* Instructions générales */}
        {data.instructions && (
          <View style={[S.diagBox, { marginTop: 4 }]}>
            <Text style={[S.sectionTitle, { marginBottom: 4 }]}>Instructions générales</Text>
            <Text style={S.diagText}>{data.instructions}</Text>
          </View>
        )}

        {/* Validité */}
        <View style={S.validiteBox}>
          <Text style={S.validiteText}>
            Ordonnance valable {data.validite_jours} jours — Expire le {fmtDate(expDate.toISOString())}
          </Text>
        </View>

        {/* Signature */}
        <View style={S.signatureBox}>
          <View>
            <Text style={S.signatureLabel}>Cachet & Signature du médecin</Text>
            <View style={S.signatureLine} />
            <Text style={[S.signatureLabel, { textAlign: 'center' }]}>Dr {data.medecin_prenom} {data.medecin_nom}</Text>
          </View>
          <View>
            <Text style={S.signatureLabel}>Date : {fmtDate(data.date_prescription)}</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={S.footer} fixed>
          <Text style={S.footerText}>{data.clinique_nom} · {data.clinique_ville}</Text>
          <Text style={S.footerText}>{data.numero} · Document confidentiel</Text>
        </View>

      </Page>
    </Document>
  )
}
