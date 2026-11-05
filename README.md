# A Peculiar F1 League

A static web app that turns the peculiar league spreadsheet into a live leaderboard.

- **Standings**: a podium for the top three, then everyone else with points, gaps, movement since the last race, chips used and each player's team. Click a player to open their page.
- **Progress**: a line chart of position (or points behind the leader) after every race. Highlight up to four players; everyone else stays grey.
- **Races**: a recap of the latest race, a form guide heat map of points per weekend, and a result table for every race.
- **Stats**: season highlights, chip stats (best and worst use of each chip, most popular races) and per-player records.
- **Seasons**: the year in the masthead switches between seasons once there is more than one.

The page re-reads your published Google Sheets when it loads, when the tab regains focus, and every five minutes. It only redraws when the data has changed. A copy of the data is bundled into the site as a fallback in case Google can't be reached.

## Run it locally

```bash
npm install
npm run dev
```

## Hosting

The site is hosted on Vercel and rebuilds on every push to `main`. Every other branch gets its own preview link, which is handy for trying changes before they go live.

## Updating scores

Nothing to deploy. Edit the sheet as you do now. Open pages pick up the change within about five minutes (or straight away via **Check for new scores**).

Google publishes sheet changes to the CSV links with a short delay, so expect a few minutes between editing the sheet and the app showing it.

The bundled fallback copy only matters if Google can't be reached. To refresh it, run `npm run snapshot` and commit the changed files in `src/data/<season>/`.

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
| Chip usage | Optional. One row per player: each chip's `TRUE`/`FALSE` flag followed by the race it was played at, plus a `Change` column for Final Fix swaps (`NOR > ANT`) with the points each driver then scored. Drives the chip stats and the Limitless budget display. |
| Colours | Optional. Blocks headed `Teams`, `Drivers` and `Chips`, each a code column followed by a hex colour. Used for the swatches on picks and the chip colours. |

Positions, gaps and movement are calculated from the points, so the rank columns in the sheet aren't used. Players can be added or removed in the sheet and the app follows. Driver codes are shown with full names via `src/lib/names.ts`. If a name differs between the two sheets by a suffix (for example `Richard` and `Richard L`) the app matches them when it's the only unmatched pair.

If you change the sheet's layout, `src/lib/parse.ts` is the only place that needs updating.

## Project layout

```
src/
  App.tsx               page shell, season picker, tabs, sync status
  components/           Standings, Recap, RecapBanner, PlayerPage, ProgressChart, FormGuide, RaceList, Stats
  lib/parse.ts          CSV to typed league data
  lib/stats.ts          highlights, chip stats and records
  lib/recap.ts          the latest-race summary
  lib/seasons.ts        season config and bundled data
  lib/route.ts          links such as #standings and #2025/standings
  lib/useLeagueData.ts  fetching, change detection, polling
  data/                 seasons.json and the bundled fallback CSVs per season
public/og.png           link preview image
scripts/update-snapshot.mjs
```
