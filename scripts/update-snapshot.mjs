// Downloads the published Google Sheets CSVs into src/data so the site has an
// up-to-date fallback bundled in. Run with: npm run snapshot
import { mkdir, readFile, writeFile } from 'node:fs/promises'

const root = new URL('../src/data/', import.meta.url)
const config = JSON.parse(await readFile(new URL('seasons.json', root), 'utf8'))

const targets = [
  ['leaderboard', 'leaderboard.csv'],
  ['history', 'history.csv'],
  ['colours', 'colours.csv'],
  ['chips', 'chipusage.csv'],
]

// Fetch everything first so a failure leaves every file untouched.
// Archived seasons are frozen in the repo and never re-downloaded.
const results = []
for (const [season, { archived, sources }] of Object.entries(config.seasons)) {
  if (archived) {
    console.log(`skipping ${season} (archived)`)
    continue
  }
  for (const [key, file] of targets) {
    const res = await fetch(sources[key])
    if (!res.ok) throw new Error(`${season} ${key}: HTTP ${res.status}`)
    const text = await res.text()
    if (/^\s*<(!doctype|html)/i.test(text)) throw new Error(`${season} ${key}: sheet is not published as CSV`)
    if (text.split('\n').length < 3) throw new Error(`${season} ${key}: sheet looks empty`)
    results.push([`${season}/${file}`, text])
  }
}

for (const [file, text] of results) {
  await mkdir(new URL(file.split('/')[0] + '/', root), { recursive: true })
  await writeFile(new URL(file, root), text.endsWith('\n') ? text : text + '\n')
  console.log(`updated ${file}`)
}
