import type { PaletteKey } from './palettes'

export const SPECIES_KEYS = [
  'hamster', 'rabbit', 'cat', 'dog', 'squirrel', 'frog',
  'bird', 'axolotl', 'bear', 'penguin', 'duck', 'seal',
] as const
export type SpeciesKey = (typeof SPECIES_KEYS)[number]

const SPECIES_SYNONYMS: Record<SpeciesKey, string[]> = {
  hamster: ['햄스터', '햄찌', '햄토리'],
  rabbit: ['토끼', '토깽', '래빗', '버니'],
  cat: ['고양이', '고냥', '냥이', '냐옹', '캣'],
  dog: ['강아지', '멍멍이', '개', '댕댕', '리트리버', '푸들', '시바', '말티즈'],
  squirrel: ['다람쥐', '람쥐', '청설모'],
  frog: ['개구리', '청개구리', '두꺼비'],
  bird: ['새', '참새', '병아리', '앵무', '올빼미', '부엉이'],
  axolotl: ['우파루파', '아홀로틀', '도롱뇽'],
  bear: ['곰', '백곰', '반달곰', '곰돌이', '테디'],
  penguin: ['펭귄', '펭구', '펭'],
  duck: ['오리', '덕', '꽥꽥'],
  seal: ['물개', '물범', '바다표범', '하프물범'],
}

const COLOR_DICT: [PaletteKey, string[]][] = [
  ['pink', ['분홍', '핑크', '벚꽃']],
  ['mint', ['민트', '초록', '녹색', '연두']],
  ['lavender', ['보라', '라벤더', '퍼플', '연보라']],
  ['peach', ['주황', '오렌지', '복숭아', '피치', '살구']],
  ['sky', ['파랑', '파란', '하늘', '블루', '바다']],
  ['lemon', ['노랑', '노란', '햇살', '레몬', '금색']],
  ['cream', ['하양', '흰', '크림', '아이보리', '베이지']],
  ['taupe', ['갈색', '브라운', '초코', '커피']],
]

// Build a sorted list of all species words (longest first) with their species key
const SPECIES_WORDS_SORTED: Array<[SpeciesKey, string]> = []
for (const [speciesKey, words] of Object.entries(SPECIES_SYNONYMS) as [SpeciesKey, string[]][]) {
  for (const word of words) {
    SPECIES_WORDS_SORTED.push([speciesKey, word])
  }
}
SPECIES_WORDS_SORTED.sort((a, b) => b[1].length - a[1].length)

function firstMatch<T>(answers: string[], entries: [T, string[]][]): T | null {
  for (const answer of answers) {
    for (const [key, words] of entries) {
      if (words.some((w) => answer.includes(w))) return key
    }
  }
  return null
}

export function matchSpecies(answers: string[]): SpeciesKey | null {
  for (const answer of answers) {
    for (const [speciesKey, word] of SPECIES_WORDS_SORTED) {
      if (answer.includes(word)) return speciesKey
    }
  }
  return null
}

export function matchPalette(answers: string[]): PaletteKey | null {
  return firstMatch(answers, COLOR_DICT)
}
