import { composeAvatar } from './compose'
import { matchPalette, matchSpecies, SPECIES_KEYS, type SpeciesKey } from './matching'
import { PALETTES, type PaletteKey } from './palettes'
import { SPECIES } from './species'

export function hashSeed(text: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h >>> 0
}

// LLM(map-avatar)이 고른 종·팔레트. 유효하지 않은 값은 필드 단위로 무시된다.
export type AvatarMapping = { species?: string; palette?: string }

export function generateAvatar(
  answers: string[],
  salt: number,
  mapping?: AvatarMapping | null,
): { map: string[]; palette: Record<string, string> } {
  const joined = answers.map((a) => a.trim()).join('')
  const baseSeed = hashSeed(joined) // 종·팔레트 폴백용 — salt 무관
  const variantSeed = hashSeed(joined + ':' + String(salt)) // 변형용 — salt 반영

  const paletteKeys = Object.keys(PALETTES) as PaletteKey[]
  const mappedSpecies =
    mapping?.species && (SPECIES_KEYS as readonly string[]).includes(mapping.species)
      ? (mapping.species as SpeciesKey)
      : null
  const mappedPalette =
    mapping?.palette && paletteKeys.includes(mapping.palette as PaletteKey)
      ? (mapping.palette as PaletteKey)
      : null

  const speciesKey =
    mappedSpecies ?? matchSpecies(answers) ?? SPECIES_KEYS[baseSeed % SPECIES_KEYS.length]
  const paletteKey =
    mappedPalette ?? matchPalette(answers) ?? paletteKeys[(baseSeed >>> 8) % paletteKeys.length]

  return composeAvatar(SPECIES[speciesKey], paletteKey, {
    eyes: (variantSeed >>> 0) & 0xff,
    mouth: (variantSeed >>> 8) & 0xff,
    cheeks: (variantSeed >>> 16) & 0xff,
    accessory: (variantSeed >>> 24) & 0xff,
  })
}
