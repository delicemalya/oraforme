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
const frKeys = new Set(Object.keys(fr))
const frCount = frKeys.size
console.log("FR keys:", frCount, "(reference)")

for (const [lang, [s, e]] of Object.entries(positions)) {
  if (lang === "fr") continue
  const kv = extractKV(i18n, s, e)
  const count = Object.keys(kv).length
  // Check missing AND duplicates
  const missing = [...frKeys].filter(k => !kv[k])
  const allKeys = Object.keys(kv)
  const seen = new Set()
  const dupes = allKeys.filter(k => { if (seen.has(k)) return true; seen.add(k); return false })
  const pct = Math.round((count / frCount) * 100)
  console.log(lang.toUpperCase() + ": " + count + " keys, missing " + missing.length + " (" + pct + "%) dupes:" + dupes.length)
  if (missing.length > 0 && missing.length < 20) console.log("  Missing:", missing.slice(0, 10).join(", "))
}
