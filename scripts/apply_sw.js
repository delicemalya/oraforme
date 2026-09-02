const fs = require("fs")
let i18n = fs.readFileSync("../lib/i18n.ts", "utf8")

// Find SW block and insertion point (last KV before closing },)
const swStart = i18n.indexOf("\n  sw: {")
const deStart = i18n.indexOf("\n  de: {")
const block = i18n.substring(swStart, deStart)

const matches = [...block.matchAll(/'[^']+':\s*'[^']*'/g)]
if (matches.length === 0) { console.log("No KV in SW block"); process.exit(1) }
const last = matches[matches.length - 1]
const lastEnd = swStart + last.index + last[0].length

// Insert after the comma following the last KV
const after = i18n.substring(lastEnd, lastEnd + 5)
let insertAt = lastEnd
if (after.startsWith(",")) insertAt = lastEnd + 1

console.log("SW insert at", insertAt, "after:", JSON.stringify(i18n.substring(insertAt - 30, insertAt + 20)))

const newKeys = "\n" + fs.readFileSync("gen_sw.ts", "utf8")
i18n = i18n.substring(0, insertAt) + newKeys + i18n.substring(insertAt)
fs.writeFileSync("../lib/i18n.ts", i18n)
console.log("Done. Total size:", i18n.length, "chars")
