const fs = require("fs")
const i18n = fs.readFileSync("./lib/i18n.ts", "utf8")

function extractKV(c, s, e) {
  const b = c.substring(s, e), kv = {}, r = /'([^']+)':\s*'([^']*)'/g
  let m; while ((m = r.exec(b)) !== null) kv[m[1]] = m[2]
  return kv
}

// French-specific markers
function isTrulyFrench(v) {
  if (!v || v.length < 3) return false
  // Contains French accents/words → probably untranslated
  const frenchPatterns = [
    /[éèêëàâçîïôùûü]/,
    /\b(de|le|la|les|du|des|un|une|en|et|avec|pour|dans|sur|comme|mais|votre|notre|mes|ses|tous|toutes|cette|cet|aux)\b/i,
    /\b(créer|modifier|supprimer|ajouter|enregistrer|annuler|fermer|retour|suivant|précédent)\b/i,
    /\b(aucun|aucune|chargement|télécharger|imprimer|exporter|importer|rechercher|filtrer)\b/i,
  ]
  return frenchPatterns.some(p => p.test(v))
}

const pos = {
  fr: [i18n.indexOf("fr: {"), i18n.indexOf("\n  en: {")],
  pt: [i18n.indexOf("\n  pt: {"), i18n.indexOf("\n  es: {")],
  es: [i18n.indexOf("\n  es: {"), i18n.indexOf("\n  ln: {")],
  de: [i18n.indexOf("\n  de: {"), i18n.indexOf("\n  kg: {")],
  ln: [i18n.indexOf("\n  ln: {"), i18n.indexOf("\n  sw: {")],
  kg: [i18n.indexOf("\n  kg: {"), i18n.length],
  sw: [i18n.indexOf("\n  sw: {"), i18n.indexOf("\n  de: {")],
}

const fr = extractKV(i18n, pos.fr[0], pos.fr[1])

for (const [lang, [s, e]] of Object.entries(pos)) {
  if (lang === "fr") continue
  const kv = extractKV(i18n, s, e)
  const needsTranslation = []
  for (const [k, v] of Object.entries(kv)) {
    if (!fr[k]) continue
    if (v === fr[k] && isTrulyFrench(v)) {
      needsTranslation.push({ k, v: fr[k] })
    }
  }
  console.log(lang + ": " + needsTranslation.length + " truly untranslated phrases")
  fs.writeFileSync("scripts/untranslated_" + lang + ".json", JSON.stringify(needsTranslation, null, 2))
}
