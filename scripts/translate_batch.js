/**
 * Batch translation using Claude Haiku API
 * Translates truly-untranslated French values for all languages
 */
const fs = require('fs')
const https = require('https')

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || ''

const LANG_NAMES = {
  pt: 'Portuguese (Brazilian)',
  es: 'Spanish (Latin America / Spain)',
  de: 'German',
  ln: 'Lingala (Congo-Brazzaville)',
  kg: 'Kituba (Congo-Brazzaville)',
  sw: 'Kiswahili',
}

const LANG_NOTES = {
  pt: 'Use Brazilian Portuguese. ERP/business terms like CNSS, TVA, OHADA, FCFA stay as-is.',
  es: 'Use Latin American Spanish. ERP terms CNSS, TVA, OHADA, FCFA stay as-is.',
  de: 'Use standard German. ERP terms CNSS, TVA, OHADA, FCFA stay as-is.',
  ln: 'Translate to Lingala. Keep technical ERP terms (CNSS, TVA, OHADA, FCFA, RH, CRM, ERP) in French as they are loanwords. UI elements should be in Lingala.',
  kg: 'Translate to Kituba (Kikongo ya létat). Keep technical ERP terms (CNSS, TVA, OHADA, FCFA) as French loanwords. UI elements should be in Kituba.',
  sw: 'Translate to Kiswahili. Keep technical ERP terms (CNSS, TVA, OHADA) as-is. Use "VAT" for TVA in Swahili context.',
}

async function callClaude(prompt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 8000,
      messages: [{ role: 'user', content: prompt }]
    })

    const options = {
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(body),
      }
    }

    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data)
          if (parsed.content && parsed.content[0]) {
            resolve(parsed.content[0].text)
          } else {
            reject(new Error('No content: ' + data))
          }
        } catch(e) {
          reject(e)
        }
      })
    })
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

async function translateBatch(items, lang) {
  const langName = LANG_NAMES[lang]
  const notes = LANG_NOTES[lang]

  const keysJson = JSON.stringify(
    items.map(({ k, v }) => ({ k, fr: v }))
  )

  const prompt = `You are a professional ERP software translator.
Translate these French UI strings to ${langName}.

RULES:
- ${notes}
- Keep placeholders like {name}, {count}, {date}, {amount} exactly as-is
- Keep HTML/special chars as-is
- Translate ONLY the text, preserve the meaning precisely
- For short labels (1-3 words), be concise
- For sentences, translate naturally
- Numbers, percentages, symbols stay as-is

Return ONLY a JSON array with the same keys and translated values:
[{"k":"key","t":"translated value"}]

French strings to translate:
${keysJson}

Return ONLY the JSON array, no explanation.`

  const result = await callClaude(prompt)

  // Extract JSON from response
  const jsonMatch = result.match(/\[[\s\S]*\]/)
  if (!jsonMatch) throw new Error('No JSON in response: ' + result.slice(0, 200))

  const translations = JSON.parse(jsonMatch[0])
  return translations
}

async function processLanguage(lang) {
  const inputFile = `scripts/untranslated_${lang}.json`
  if (!fs.existsSync(inputFile)) {
    console.log(`${lang}: no untranslated file found`)
    return {}
  }

  const items = JSON.parse(fs.readFileSync(inputFile, 'utf8'))
  console.log(`${lang}: translating ${items.length} phrases...`)

  const BATCH_SIZE = 80
  const allTranslations = {}
  let errors = 0

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE)
    const batchNum = Math.floor(i / BATCH_SIZE) + 1
    const totalBatches = Math.ceil(items.length / BATCH_SIZE)

    process.stdout.write(`  Batch ${batchNum}/${totalBatches}...`)

    try {
      const translations = await translateBatch(batch, lang)
      for (const { k, t } of translations) {
        if (k && t) allTranslations[k] = t
      }
      process.stdout.write(` OK (${translations.length})\n`)
    } catch(e) {
      errors++
      process.stdout.write(` ERROR: ${e.message.slice(0, 60)}\n`)
      // Continue with next batch
    }

    // Small delay to avoid rate limits
    if (i + BATCH_SIZE < items.length) {
      await new Promise(r => setTimeout(r, 300))
    }
  }

  console.log(`${lang}: got ${Object.keys(allTranslations).length} translations (${errors} batch errors)`)
  fs.writeFileSync(`scripts/translated_${lang}.json`, JSON.stringify(allTranslations, null, 2))
  return allTranslations
}

async function applyTranslations(lang, translations) {
  if (!Object.keys(translations).length) return

  let i18n = fs.readFileSync('./lib/i18n.ts', 'utf8')

  // Find the language block boundaries
  const langStartStr = '\n  ' + lang + ': {'
  const langStart = i18n.indexOf(langStartStr)
  if (langStart === -1) { console.log(lang + ': block not found'); return }

  const nextLangs = ['  pt:', '  es:', '  ln:', '  sw:', '  de:', '  kg:']
  let blockEnd = i18n.length
  for (const nl of nextLangs) {
    const pos = i18n.indexOf('\n  ' + nl.trim(), langStart + 10)
    if (pos !== -1 && pos > langStart && pos < blockEnd) {
      // Only use next language after current
      const currentIdx = ['pt','es','ln','sw','de','kg'].indexOf(lang)
      const nextIdx = ['pt','es','ln','sw','de','kg'].indexOf(nl.replace(':','').trim())
      if (nextIdx > currentIdx) { blockEnd = pos; break }
    }
  }

  // Apply each translation
  let replaced = 0
  for (const [key, newVal] of Object.entries(translations)) {
    // Find the key in the language block and replace its value
    const blockContent = i18n.substring(langStart, blockEnd)
    // Match: '${key}': '${oldVal}'
    const pattern = new RegExp("'(" + key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ")':\\s*'([^']*)'")
    const match = blockContent.match(pattern)
    if (match) {
      const oldStr = match[0]
      const escaped = newVal.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
      const newStr = "'" + key + "': '" + escaped + "'"
      i18n = i18n.substring(0, langStart) +
             blockContent.replace(oldStr, newStr) +
             i18n.substring(blockEnd)
      // Recalculate blockEnd after replacement
      blockEnd = blockEnd + (newStr.length - oldStr.length)
      replaced++
    }
  }

  fs.writeFileSync('./lib/i18n.ts', i18n)
  console.log(lang + ': applied ' + replaced + '/' + Object.keys(translations).length + ' replacements')
}

async function main() {
  const LANGS = ['pt', 'es', 'de', 'sw', 'ln', 'kg']

  for (const lang of LANGS) {
    try {
      const translations = await processLanguage(lang)
      await applyTranslations(lang, translations)
    } catch(e) {
      console.error(lang + ' FAILED:', e.message)
    }
  }

  console.log('\nAll done!')
}

main().catch(console.error)
