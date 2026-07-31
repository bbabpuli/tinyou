import { PALETTES, type PaletteKey } from './palettes'
import { ACCESSORY_STYLES, CHEEK_STYLES, EYE_STYLES, MOUTH_STYLES, WINK_STAMP } from './overlays'
import type { Species, Stamp, Variant } from './types'

const FIXED = { O: '#4a3f35', E: '#333333', W: '#ffffff', M: '#a2574f', A: '#f08c5a' }

function stamp(grid: string[][], anchor: [number, number], s: Stamp): void {
  for (const [dr, dc, ch] of s) {
    const r = anchor[0] + dr
    const c = anchor[1] + dc
    if (r >= 0 && r < 32 && c >= 0 && c < 32) grid[r][c] = ch
  }
}

export function composeAvatar(
  species: Species,
  paletteKey: PaletteKey,
  variant: Variant,
): { map: string[]; palette: Record<string, string> } {
  const grid = species.baseMap.map((row) => row.split(''))
  const eyeStyle = EYE_STYLES[variant.eyes % EYE_STYLES.length]
  const isWink = variant.eyes % EYE_STYLES.length === 3

  species.anchors.eyes.forEach((anchor, i) => {
    stamp(grid, anchor, isWink && i === 1 ? WINK_STAMP : eyeStyle)
  })
  stamp(grid, species.anchors.mouth, MOUTH_STYLES[variant.mouth % MOUTH_STYLES.length])
  for (const anchor of species.anchors.cheeks) {
    stamp(grid, anchor, CHEEK_STYLES[variant.cheeks % CHEEK_STYLES.length])
  }
  stamp(grid, species.anchors.accessory, ACCESSORY_STYLES[variant.accessory % ACCESSORY_STYLES.length])

  const p = PALETTES[paletteKey]
  return {
    map: grid.map((row) => row.join('')),
    palette: { ...FIXED, B: p.B, S: p.S, C: p.C, D: p.D },
  }
}
