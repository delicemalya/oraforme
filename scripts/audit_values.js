const fs = require("fs")
const i18n = fs.readFileSync("./lib/i18n.ts", "utf8")

function extractKV(c, s, e) {
  const b = c.substring(s, e), kv = {}, r = /'([^']+)':\s*'([^']*)'/g
  let m; while ((m = r.exec(b)) !== null) kv[m[1]] = m[2]
  return kv
}

const pos = {
  fr: [i18n.indexOf("fr: {"), i18n.indexOf("\n  en: {")],
  pt: [i18n.indexOf("\n  pt: {"), i18n.indexOf("\n  es: {")],
  es: [i18n.indexOf("\n  es: {"), i18n.indexOf("\n  ln: {")],
  de: [i18n.indexOf("\n  de: {"), i18n.indexOf("\n  kg: {")],
  ln: [i18n.indexOf("\n  ln: {"), i18n.indexOf("\n  sw: {")],
  kg: [i18n.indexOf("\n  kg: {"), i18n.length],
}

const fr = extractKV(i18n, pos.fr[0], pos.fr[1])

for (const [lang, [s, e]] of Object.entries(pos)) {
  if (lang === "fr") continue
  const kv = extractKV(i18n, s, e)
  // Count keys where value === FR value (not translated)
  let unchanged = 0, total = 0
  const examples = []
  for (const [k, v] of Object.entries(kv)) {
    if (!fr[k]) continue
    total++
    if (v === fr[k]) {
      unchanged++
      if (examples.length < 5) examples.push(k + ": " + v)
    }
  }
  const pct = Math.round(unchanged / total * 100)
  console.log(lang.toUpperCase() + ": " + unchanged + "/" + total + " values identical to FR (" + pct + "% untranslated)")
  examples.forEach(e => console.log("  * " + e))
}
