const fs = require("fs")
const i18n = fs.readFileSync("../lib/i18n.ts", "utf8")

const SW_MAP = {
  "Trésorerie": "Hazina", "Solde": "Salio", "Compte": "Akaunti",
  "Encaissement": "Mapato", "Décaissement": "Matumizi", "Facture": "Ankara",
  "Factures": "Ankara", "Employé": "Mfanyakazi", "Employés": "Wafanyakazi",
  "Contrat": "Mkataba", "Salaire": "Mshahara",
  "Stock": "Hifadhi", "Produit": "Bidhaa", "Produits": "Bidhaa",
  "Fournisseur": "Msambazaji", "Client": "Mteja", "Clients": "Wateja",
  "Caisse": "Sanduku la fedha", "Banque": "Benki",
  "Rapport": "Ripoti", "Analyse": "Uchambuzi",
  "Annuler": "Ghairi", "Confirmer": "Thibitisha", "Supprimer": "Futa",
  "Modifier": "Hariri", "Ajouter": "Ongeza", "Fermer": "Funga", "Retour": "Rudi",
  "Valider": "Thibitisha", "Soumettre": "Wasilisha",
  "Rechercher": "Tafuta", "Filtrer": "Chuja", "Exporter": "Hamisha",
  "Oui": "Ndiyo", "Non": "Hapana",
  "Total": "Jumla", "Montant": "Kiasi", "Date": "Tarehe",
  "Mois": "Mwezi", "Année": "Mwaka", "Semaine": "Wiki", "Jour": "Siku",
  "Actif": "Amilifu", "Inactif": "Si amilifu",
  "En cours": "Inaendelea", "Terminé": "Imekamilika",
  "En attente": "Inasubiri", "Validé": "Imethibitishwa", "Refusé": "Imekataliwa",
  "Aucun": "Hakuna", "Aucune": "Hakuna",
  "Paramètres": "Mipangilio", "Profil": "Wasifu",
  "Notifications": "Arifa", "Paiement": "Malipo",
  "Vente": "Mauzo", "Dépense": "Gharama", "Recette": "Mapato",
  "TVA": "VAT", "Taxe": "Kodi",
  "Enseignant": "Mwalimu", "Chambre": "Chumba", "Salle": "Ukumbi",
  "Commande": "Agizo", "Menu": "Menyu", "Table": "Meza",
  "Plat": "Sahani", "Service": "Huduma",
  "Article": "Bidhaa", "Catégorie": "Jamii",
  "Rôle": "Jukumu", "Permission": "Ruhusa",
  "Utilisateur": "Mtumiaji", "Équipe": "Timu",
  "Document": "Hati", "Fichier": "Faili",
  "Erreur": "Hitilafu",
}

function translateValue(frVal) {
  let result = frVal
  const entries = Object.entries(SW_MAP).sort((a, b) => b[0].length - a[0].length)
  for (const [fr, tgt] of entries) {
    if (result.includes(fr)) {
      let safe = fr.replace(/[-[\]{}()*+?,\\^$|#\s]/g, "\\$&")
      try { result = result.replace(new RegExp(safe, "g"), tgt) } catch {}
    }
  }
  return result
}

function esc(s) {
  return s.replace(/\\/g, "\\\\").replace(/'/g, "\\'")
}

function extractKV(c, s, e) {
  const b = c.substring(s, e), kv = {}, r = /'([^']+)':\s*'([^']*)'/g
  let m; while ((m = r.exec(b)) !== null) kv[m[1]] = m[2]
  return kv
}

const frStart = i18n.indexOf("fr: {")
const enStart = i18n.indexOf("\n  en: {")
const fr = extractKV(i18n, frStart, enStart)

const swStart = i18n.indexOf("\n  sw: {")
const deStart = i18n.indexOf("\n  de: {")
const sw = extractKV(i18n, swStart, deStart)
console.log("SW existing:", Object.keys(sw).length, "FR total:", Object.keys(fr).length)

const missing = Object.entries(fr).filter(([k]) => !sw[k])
console.log("SW missing:", missing.length)

const lines = ["    // -- Auto-generated SW translations --"]
for (const [k, v] of missing) {
  lines.push("    '" + k + "': '" + esc(translateValue(v)) + "',")
}
fs.writeFileSync("gen_sw.ts", lines.join("\n"))
console.log("gen_sw.ts written:", missing.length, "keys")
