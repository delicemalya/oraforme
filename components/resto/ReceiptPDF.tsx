import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'

export interface ReceiptData {
  numero_recu: string
  date: string
  heure: string
  table_num: string
  mode: string
  items: { nom: string; quantite: number; prix: number }[]
  sous_total_ht: number
  tva: number
  ca: number
  total_ttc: number
  mode_paiement: string
  reference?: string | null
  nom_restaurant: string
  adresse?: string | null
  telephone?: string | null
}

const s = StyleSheet.create({
  page:    { padding: 16, backgroundColor: '#FFFFFF', fontFamily: 'Helvetica', fontSize: 8, color: '#111111', width: 226 },
  center:  { textAlign: 'center' },
  bold:    { fontFamily: 'Helvetica-Bold' },
  gray:    { color: '#6B7280' },
  sep:     { borderBottom: '1px dashed #CCCCCC', marginVertical: 6 },
  row:     { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  gold:    { color: '#DC2626' },
  large:   { fontSize: 11, fontFamily: 'Helvetica-Bold' },
  xlarge:  { fontSize: 14, fontFamily: 'Helvetica-Bold' },
  small:   { fontSize: 7, color: '#9CA3AF' },
})

const MODE_LABELS: Record<string, string> = {
  especes: 'Espèces', airtel: 'Airtel Money', mtn: 'MTN MoMo',
  virement: 'Virement', carte: 'Carte bancaire',
  sur_place: 'Sur place', emporter: 'À emporter', livraison: 'Livraison',
}

export function ReceiptPDF({ data }: { data: ReceiptData }) {
  return (
    <Document title={`Reçu ${data.numero_recu}`}>
      <Page size={[226, 600]} style={s.page}>

        {/* En-tête */}
        <Text style={[s.center, s.xlarge]}>{data.nom_restaurant}</Text>
        {data.adresse  && <Text style={[s.center, s.gray, { marginTop: 2 }]}>{data.adresse}</Text>}
        {data.telephone && <Text style={[s.center, s.gray]}>{data.telephone}</Text>}

        <View style={s.sep} />

        <View style={s.row}>
          <Text style={s.gray}>N° Reçu :</Text>
          <Text style={s.bold}>{data.numero_recu}</Text>
        </View>
        <View style={s.row}>
          <Text style={s.gray}>Date :</Text>
          <Text>{data.date}</Text>
        </View>
        <View style={s.row}>
          <Text style={s.gray}>Heure :</Text>
          <Text>{data.heure}</Text>
        </View>
        <View style={s.row}>
          <Text style={s.gray}>Table :</Text>
          <Text>{data.table_num || 'À emporter'}</Text>
        </View>

        <View style={s.sep} />

        {/* Articles */}
        {data.items.map((item, i) => (
          <View key={i} style={{ marginBottom: 4 }}>
            <View style={s.row}>
              <Text style={[s.bold, { flex: 1 }]}>{item.nom}</Text>
              <Text style={s.gray}>×{item.quantite}</Text>
            </View>
            <View style={s.row}>
              <Text style={s.small}>{item.prix.toLocaleString('fr-FR')} FCFA × {item.quantite}</Text>
              <Text style={s.bold}>{(item.prix * item.quantite).toLocaleString('fr-FR')} FCFA</Text>
            </View>
          </View>
        ))}

        <View style={s.sep} />

        {/* Totaux */}
        <View style={s.row}>
          <Text style={s.gray}>Sous-total HT</Text>
          <Text>{data.sous_total_ht.toLocaleString('fr-FR')} FCFA</Text>
        </View>
        <View style={s.row}>
          <Text style={s.gray}>TVA (18%)</Text>
          <Text>{data.tva.toLocaleString('fr-FR')} FCFA</Text>
        </View>
        <View style={s.row}>
          <Text style={s.gray}>CA (5% TVA)</Text>
          <Text>{data.ca.toLocaleString('fr-FR')} FCFA</Text>
        </View>

        <View style={[s.sep, { marginTop: 4 }]} />

        <View style={[s.row, { marginTop: 2 }]}>
          <Text style={[s.large]}>TOTAL TTC</Text>
          <Text style={[s.large, s.gold]}>{data.total_ttc.toLocaleString('fr-FR')} FCFA</Text>
        </View>

        <View style={s.sep} />

        <View style={s.row}>
          <Text style={s.gray}>Mode de paiement</Text>
          <Text style={s.bold}>{MODE_LABELS[data.mode_paiement] ?? data.mode_paiement}</Text>
        </View>
        {data.reference && (
          <View style={s.row}>
            <Text style={s.gray}>{'Référence'}</Text>
            <Text>{data.reference}</Text>
          </View>
        )}

        <View style={s.sep} />

        <Text style={[s.center, s.bold, { marginTop: 4 }]}>Merci de votre visite !</Text>
        <Text style={[s.center, s.small, { marginTop: 2 }]}>Conservez ce reçu</Text>
      </Page>
    </Document>
  )
}
