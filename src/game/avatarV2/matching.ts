import type { PaletteKey } from './palettes'

export const SPECIES_KEYS = [
  'hamster', 'rabbit', 'cat', 'dog', 'squirrel', 'frog',
  'bird', 'axolotl', 'bear', 'penguin', 'duck', 'seal',
] as const
export type SpeciesKey = (typeof SPECIES_KEYS)[number]

/**
 * 매칭은 단순 부분문자열 검색이라 1글자 유의어는 일상어를 잘못 집어삼킨다
 * ('새로운'→bird, '개성'→dog, '덕분에'→duck, '펭' 등). 그래서 1글자 항목은 모두 뺐다.
 * 예외로 '곰'만 남긴다 — '곰'을 포함하는 흔한 일상어가 거의 없고("곰곰이" 정도),
 * "곰 같아" 같은 묘사는 실제로 자주 쓰여 얻는 값이 오탐 위험보다 크다고 판단했다.
 */
const SPECIES_SYNONYMS: Record<SpeciesKey, string[]> = {
  hamster: ['햄스터', '햄찌', '햄토리'],
  rabbit: ['토끼', '토깽', '래빗', '버니'],
  cat: ['고양이', '고냥', '냥이', '냐옹', '캣'],
  dog: ['강아지', '멍멍이', '댕댕', '리트리버', '푸들', '시바', '말티즈'],
  squirrel: ['다람쥐', '람쥐', '청설모'],
  frog: ['개구리', '청개구리', '두꺼비'],
  bird: ['참새', '병아리', '앵무', '올빼미', '부엉이'],
  axolotl: ['우파루파', '아홀로틀', '도롱뇽'],
  bear: ['곰', '백곰', '반달곰', '곰돌이', '테디'],
  penguin: ['펭귄', '펭구'],
  duck: ['오리', '꽥꽥'],
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

// Build a list of all species words with their species key
const SPECIES_WORDS: Array<[SpeciesKey, string]> = []
for (const [speciesKey, words] of Object.entries(SPECIES_SYNONYMS) as [SpeciesKey, string[]][]) {
  for (const word of words) {
    SPECIES_WORDS.push([speciesKey, word])
  }
}

// Generic helper: find best match by position then word length
function findBestMatch<T>(
  answer: string,
  candidates: Array<[T, string]>,
): T | null {
  const matches: Array<{ key: T; word: string; index: number; length: number }> = []

  for (const [key, word] of candidates) {
    const index = answer.indexOf(word)
    if (index !== -1) {
      matches.push({ key, word, index, length: word.length })
    }
  }

  if (matches.length === 0) return null

  // Sort by: position first (leftmost), then by length (longest)
  matches.sort((a, b) => {
    if (a.index !== b.index) return a.index - b.index
    return b.length - a.length
  })

  return matches[0].key
}

export function matchSpecies(answers: string[]): SpeciesKey | null {
  for (const answer of answers) {
    const match = findBestMatch(answer, SPECIES_WORDS)
    if (match) return match
  }
  return null
}

export function matchPalette(answers: string[]): PaletteKey | null {
  for (const answer of answers) {
    const colorCandidates: Array<[PaletteKey, string]> = []
    for (const [paletteKey, words] of COLOR_DICT) {
      for (const word of words) {
        colorCandidates.push([paletteKey, word])
      }
    }
    const match = findBestMatch(answer, colorCandidates)
    if (match) return match
  }
  return null
}
