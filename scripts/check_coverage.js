const fs = require("fs")
const i18n = fs.readFileSync("./lib/i18n.ts", "utf8")

function extractKV(c, s, e) {
  const b = c.substring(s, e), kv = {}, r = /'([^']+)':\s*'([^']*)'/g
  let m; while ((m = r.exec(b)) !== null) kv[m[1]] = m[2]
  return kv
}

const positions = {
  fr: [i18n.indexOf("fr: {"), i18n.indexOf("\n  en: {")],
  en: [i18n.indexOf("\n  en: {"), i18n.indexOf("\n  pt: {")],
  pt: [i18n.indexOf("\n  pt: {"), i18n.indexOf("\n  es: {")],
  es: [i18n.indexOf("\n  es: {"), i18n.indexOf("\n  ln: {")],
  ln: [i18n.indexOf("\n  ln: {"), i18n.indexOf("\n  sw: {")],
  sw: [i18n.indexOf("\n  sw: {"), i18n.indexOf("\n  de: {")],
  de: [i18n.indexOf("\n  de: {"), i18n.indexOf("\n  kg: {")],
  kg: [i18n.indexOf("\n  kg: {"), i18n.length],
}

const fr = extractKV(i18n, positions.fr[0], positions.fr[1])
const frCount = Object.keys(fr).length
console.log("FR keys:", frCount, "(reference)")

for (const [lang, [s, e]] of Object.entries(positions)) {
  if (lang === "fr") continue
  const kv = extractKV(i18n, s, e)
  const count = Object.keys(kv).length
  const missing = Object.keys(fr).filter(k => !kv[k]).length
  const pct = Math.round((count / frCount) * 100)
  console.log(lang.toUpperCase() + ": " + count + " keys, missing " + missing + " (" + pct + "%)")
}
