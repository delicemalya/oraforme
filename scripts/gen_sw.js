const fs = require('fs')
const i18n = fs.readFileSync('../lib/i18n.ts', 'utf8')

const SW_MAP = {
  'Trésorerie': 'Hazina', 'Solde': 'Salio', 'Compte': 'Akaunti', 'Comptes': 'Akaunti',
  'Encaissement': 'Mapato', 'Décaissement': 'Matumizi', 'Facture': 'Ankara',
  'Factures': 'Ankara', 'Employé': 'Mfanyakazi', 'Employés': 'Wafanyakazi',
  'Contrat': 'Mkataba', 'Salaire': 'Mshahara', 'Paie': 'Malipo ya mishahara',
  'Stock': 'Hifadhi', 'Produit': 'Bidhaa', 'Produits': 'Bidhaa',
  'Fournisseur': 'Msambazaji', 'Client': 'Mteja', 'Clients': 'Wateja',
  'Caisse': 'Sanduku la fedha', 'Banque': 'Benki', 'Banques': 'Mabenki',
  'Restaurant': 'Mkahawa', 'Ecole': 'Shule', 'Hotel': 'Hoteli',
  'Rapport': 'Ripoti', 'Rapports': 'Ripoti', 'Analyse': 'Uchambuzi',
  'Chargement': 'Inapakia', 'Enregistrement': 'Inahifadhi',
  'Annuler': 'Ghairi', 'Confirmer': 'Thibitisha', 'Supprimer': 'Futa',
  'Modifier': 'Hariri', 'Ajouter': 'Ongeza', 'Créer': 'Unda',
  'Sauvegarder': 'Hifadhi', 'Fermer': 'Funga', 'Retour': 'Rudi',
  'Suivant': 'Inayofuata', 'Valider': 'Thibitisha', 'Soumettre': 'Wasilisha',
  'Rechercher': 'Tafuta', 'Filtrer': 'Chuja', 'Exporter': 'Hamisha',
  'Importer': 'Ingiza', 'Télécharger': 'Pakua', 'Imprimer': 'Chapisha',
  'Oui': 'Ndiyo', 'Non': 'Hapana',
  'Total': 'Jumla', 'Montant': 'Kiasi', 'Date': 'Tarehe',
  'Période': 'Kipindi', 'Mois': 'Mwezi', 'Année': 'Mwaka',
  'Semaine': 'Wiki', 'Jour': 'Siku', 'Heure': 'Saa',
  'Actif': 'Amilifu', 'Inactif': 'Si amilifu', 'Suspendu': 'Imesimamishwa',
  'En cours': 'Inaendelea', 'Terminé': 'Imekamilika', 'Annulé': 'Imeghairiwa',
  'En attente': 'Inasubiri', 'Validé': 'Imethibitishwa', 'Refusé': 'Imekataliwa',
  'Aucun': 'Hakuna', 'Aucune': 'Hakuna',
  'Tableau de bord': 'Dashibodi', 'Dashboard': 'Dashibodi',
  'Paramètres': 'Mipangilio', 'Profil': 'Wasifu',
  'Notifications': 'Arifa', 'Alertes': 'Tahadhari',
  'Paiement': 'Malipo', 'Paiements': 'Malipo',
  'Impayé': 'Haijalipiwa', 'Achats': 'Ununuzi',
  'Vente': 'Mauzo', 'Ventes': 'Mauzo', 'Dépense': 'Gharama',
  'Recette': 'Mapato', 'TVA': 'VAT', 'Taxe': 'Kodi',
  'Note': 'Alama', 'Absence': 'Kutokuwepo',
  'Classe': 'Darasa', 'Étudiant': 'Mwanafunzi', 'Étudiants': 'Wanafunzi',
  'Enseignant': 'Mwalimu', 'Enseignants': 'Walimu',
  'Diplôme': 'Shahada', 'Chambre': 'Chumba', 'Salle': 'Ukumbi',
  'Réservation': 'Uhifadhi', 'Commande': 'Agizo', 'Commandes': 'Maagizo',
  'Menu': 'Menyu', 'Table': 'Meza', 'Tables': 'Meza',
  'Plat': 'Sahani', 'Service': 'Huduma', 'Services': 'Huduma',
  'Inventaire': 'Orodha', 'Article': 'Bidhaa', 'Articles': 'Bidhaa',
  'Catégorie': 'Jamii', 'Mouvement': 'Harakati',
  'Entrée': 'Ingizo', 'Sortie': 'Toka', 'Sorties': 'Matoka',
  'Ajustement': 'Marekebisho', 'Transfert': 'Uhamishaji',
  'Rôle': 'Jukumu', 'Permission': 'Ruhusa',
  'Utilisateur': 'Mtumiaji', 'Utilisateurs': 'Watumiaji',
  'Équipe': 'Timu', 'Membre': 'Mwanachama', 'Membres': 'Wanachama',
  'Document': 'Hati', 'Fichier': 'Faili',
  'Erreur': 'Hitilafu', 'Connexion': 'Ingia',
  'Inscription': 'Jiandikishe',
}

function translateValue(frVal, map) {
  let result = frVal
  const entries = Object.entries(map).sort((a, b) => b[0].length - a[0].length)
  for (const [fr, tgt] of entries) {
    if (result.includes(fr)) {
      let safe = fr.replace(/[-[\]{}()*+?.,\^$|#\s]/g, '\$&')
      result = result.replace(new RegExp(safe, 'g'), tgt)
    }
  }
  return result
}
function escape(s) { return s.replace(/\/g, '\\').replace(/'/g, "\'")}

function extractKV(c, s, e) {
  const b = c.substring(s, e), kv = {}, r = /'([^']+)':\s*'([^']*)'/g
  let m; while ((m = r.exec(b)) !== null) kv[m[1]] = m[2]
  return kv
}

const frStart = i18n.indexOf('fr: {')
const enStart = i18n.indexOf('\n  en: {')
const fr = extractKV(i18n, frStart, enStart)

const swStart = i18n.indexOf('\n  sw: {')
const deStart = i18n.indexOf('\n  de: {')
const sw = extractKV(i18n, swStart, deStart)

const missing = Object.entries(fr).filter(([k]) => !sw[k])
console.log('SW missing:', missing.length)

let lines = ['    // -- Auto-generated SW translations --']
for (const [k, v] of missing) {
  const t = translateValue(v, SW_MAP)
  lines.push("    '" + k + "': '" + escape(t) + "',")
}
fs.writeFileSync('gen_sw.ts', lines.join('\n'))
console.log('gen_sw.ts written')
