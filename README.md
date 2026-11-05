# A Peculiar F1 League

A static web app that turns the peculiar league spreadsheet into a live leaderboard.

- **Standings**: points, gaps to the player ahead and to the leader, movement since the last race, chips used, and each player's current team.
- **Progress**: a line chart of position (or points behind the leader) after every race. Highlight up to four players; everyone else stays grey. Hover or use the arrow keys to inspect a race.
- **Races**: a form guide heat map of points per weekend, plus a result table for every race.
- **Stats**: season highlights (best race, race wins, weeks in the lead, biggest climb, sprint specialist and more), per-player records and who everyone picked.

The page re-reads your published Google Sheets when it loads, when the tab regains focus, and every five minutes. It only redraws when the data has changed. A copy of the data is bundled into the site as a fallback in case Google can't be reached.

## Run it locally

```bash
npm install
npm run dev
```

## Put it on GitHub Pages

1. Create an empty repository on GitHub (for example `a-peculiar-f1-league`). Don't add a README or licence.
2. From this folder:

   ```bash
   git init
   git add .
   git commit -m "A Peculiar F1 League app"
   git branch -M main
   git remote add origin https://github.com/<your-username>/a-peculiar-f1-league.git
   git push -u origin main
   ```

3. In the repository go to **Settings → Pages** and set **Source** to **GitHub Actions**.
4. Open the **Actions** tab. The "Deploy to GitHub Pages" workflow runs on every push to `main`. When it finishes, your site is at `https://<your-username>.github.io/a-peculiar-f1-league/`.

## Updating scores

Nothing to deploy. Edit the sheet as you do now. Open pages pick up the change within about five minutes (or straight away via **Check for new scores**).

Google publishes sheet changes to the CSV links with a short delay, so expect a few minutes between editing the sheet and the app showing it.

The workflow also rebuilds once a day to refresh the bundled fallback. To refresh it by hand, run `npm run snapshot` and commit the changed files in `src/data/`. GitHub pauses scheduled workflows on repositories with no activity for 60 days; the live refresh in the browser isn't affected.

## Starting a new season

Do these in order once the last race of the year has been scored.

1. **Freeze the old season.** Run `npm run snapshot` and commit the changed files in `src/data/<year>/`, so the repo holds the final scores. Then set `"archived": true` for that year in `src/data/seasons.json`. From then on it is never fetched, so its sheet can be unpublished or deleted.
2. **Make next year's sheet.** Copy the spreadsheet (so the tabs and column headings match), clear the scores, and publish the four tabs (leaderboard, history, colours, chip usage) as CSV.
3. **Add it to the config.** In `src/data/seasons.json` add the new year under `seasons` with `"archived": false` and the four published links, and change `"current"` to the new year.
4. **Bundle its first copy.** Run `npm run snapshot` again and commit. It creates `src/data/<new year>/` for the fallback copy.
5. **Check the site.** The year in the masthead becomes a dropdown with both seasons. Links to the current season stay short (`#standings`); older seasons use the year (`#2025/standings`).

The browser tab title in `index.html` still has a year in it; change it if you want.

## How the sheets are read

The published CSV links live in `src/data/seasons.json`, one entry per season. Each season's bundled fallback CSVs live in `src/data/<season>/`. To archive a season, set `"archived": true` in `seasons.json`: it is then served from the bundled copy only and never fetched.

| Sheet | What the app expects |
| --- | --- |
| Leaderboard | Header row with `Player`, an optional `Team Name`, `Points`, `LL WC FF AP NN 3X` (TRUE = chip used), then `Team 1` followed by 2 constructors and 5 drivers as code/price column pairs (the first driver is the 2x pick), then `Value`, `Cap`, `Budget`. |
| History | A `Races` column, then for each player a cumulative-total column followed by a race-score column. Races with no scores yet are treated as upcoming. `(Sp)` after a race name marks a sprint weekend. |
| Colours | Optional. Blocks headed `Teams`, `Drivers` and `Chips`, each a code column followed by a hex colour. Used for the swatches on picks and the chip colours. |

Positions, gaps and movement are calculated from the points, so the rank columns in the sheet aren't used. Players can be added or removed in the sheet and the app follows. If a name differs between the two sheets by a suffix (for example `Richard` and `Richard L`) the app matches them when it's the only unmatched pair.

If you change the sheet's layout, `src/lib/parse.ts` is the only place that needs updating.

## Project layout

```
src/
  App.tsx               page shell, tabs, sync status
  components/           Standings, ProgressChart, FormGuide, RaceList, Stats
  lib/parse.ts          CSV to typed league data
  lib/stats.ts          highlights and records
  lib/useLeagueData.ts  fetching, change detection, polling
  data/                 seasons.json and the bundled fallback CSVs per season
scripts/update-snapshot.mjs
.github/workflows/deploy.yml
```
