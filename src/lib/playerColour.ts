/** One colour per player, shared by the progress chart and the standings position blocks. */
export const PLAYER_COLOURS = 14

/**
 * Colours follow the player, not their rank: alphabetical order keeps each player's colour fixed as the standings
 * change. The palette has 14 colours (--p1 to --p14), so a league with more players than that would repeat colours.
 */
export function playerColour(names: string[], name: string): string {
  const sorted = [...names].sort((a, b) => a.localeCompare(b))
  const i = Math.max(0, sorted.indexOf(name))
  return `var(--p${(i % PLAYER_COLOURS) + 1})`
}
