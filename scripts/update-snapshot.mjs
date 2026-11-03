// Downloads the published Google Sheets CSVs into src/data so the site has an
// up-to-date fallback bundled in. Run with: npm run snapshot
import { readFile, writeFile } from 'node:fs/promises'

const root = new URL('../src/data/', import.meta.url)
const sources = JSON.parse(await readFile(new URL('sources.json', root), 'utf8'))

const targets = [
  ['leaderboard', 'leaderboard.csv'],
  ['history', 'history.csv'],
  ['colours', 'colours.csv'],
]

// Fetch everything first so a failure leaves both files untouched.
const results = []
for (const [key, file] of targets) {
  const res = await fetch(sources[key])
  if (!res.ok) throw new Error(`${key}: HTTP ${res.status}`)
  const text = await res.text()
  if (/^\s*<(!doctype|html)/i.test(text)) throw new Error(`${key}: sheet is not published as CSV`)
  if (text.split('\n').length < 3) throw new Error(`${key}: sheet looks empty`)
  results.push([file, text])
}

for (const [file, text] of results) {
  await writeFile(new URL(file, root), text.endsWith('\n') ? text : text + '\n')
  console.log(`updated ${file}`)
}
