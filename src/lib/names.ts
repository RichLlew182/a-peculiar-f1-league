/** Full names for the driver and constructor codes used in the sheet. */
export const DRIVER_NAMES: Record<string, string> = {
  ANT: 'Kimi Antonelli',
  VER: 'Max Verstappen',
  HAM: 'Lewis Hamilton',
  LEC: 'Charles Leclerc',
  RUS: 'George Russell',
  NOR: 'Lando Norris',
  PIA: 'Oscar Piastri',
  HAD: 'Isack Hadjar',
  GAS: 'Pierre Gasly',
  LIN: 'Arvid Lindblad',
  SAI: 'Carlos Sainz',
  COL: 'Franco Colapinto',
  BOR: 'Gabriel Bortoleto',
  BEA: 'Oliver Bearman',
  LAW: 'Liam Lawson',
  HUL: 'Nico Hülkenberg',
  PER: 'Sergio Pérez',
  ALO: 'Fernando Alonso',
  HIR: 'Ryo Hirakawa',
  ALB: 'Alexander Albon',
  BOT: 'Valtteri Bottas',
  STR: 'Lance Stroll',
}

export const TEAM_NAMES: Record<string, string> = {
  MER: 'Mercedes',
  FER: 'Ferrari',
  RBR: 'Red Bull',
  MCL: 'McLaren',
  VCARB: 'Racing Bulls',
  ALP: 'Alpine',
  HAA: 'Haas',
  AUD: 'Audi',
  WIL: 'Williams',
  CAD: 'Cadillac',
  AST: 'Aston Martin',
}

/** Full driver name, or the code itself if we don't know it. */
export const driverName = (code: string) => DRIVER_NAMES[code.toUpperCase()] ?? code
