/**
 * 절차적 도트 아바타: 답변 텍스트+salt를 해시해 파츠(몸 색·모양·눈·입·볼·액세서리)를
 * 결정적으로 조합한다. 16×16 문자 그리드 + 팔레트 반환 (drawPixelMap과 호환).
 */

export function hashSeed(text: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h >>> 0
}

// 몸 색: {B: 본체, S: 음영, C: 볼}
const BODY_COLORS: { B: string; S: string; C: string }[] = [
  { B: '#ffb7c9', S: '#e896ab', C: '#ff6b9d' }, // 분홍
  { B: '#a8e6cf', S: '#84c7ae', C: '#56b58c' }, // 민트
  { B: '#c9b6e4', S: '#a894c9', C: '#8f6fc0' }, // 라벤더
  { B: '#ffd3a5', S: '#e6b482', C: '#f08c5a' }, // 피치
  { B: '#a5d8ff', S: '#7fb8e6', C: '#5a9cf0' }, // 하늘
  { B: '#fff3a5', S: '#e6d67f', C: '#e6b800' }, // 레몬
]

// 몸 모양 3종 (16×16, B=본체, 하단은 발/여백)
const BODY_SHAPES: string[][] = [
  [ // 둥근 블롭
    '................',
    '....BBBBBBBB....',
    '...BBBBBBBBBB...',
    '..BBBBBBBBBBBB..',
    '..BBBBBBBBBBBB..',
    '.BBBBBBBBBBBBBB.',
    '.BBBBBBBBBBBBBB.',
    '.BBBBBBBBBBBBBB.',
    '.BBBBBBBBBBBBBB.',
    '.BBBBBBBBBBBBBB.',
    '..BBBBBBBBBBBB..',
    '..BBBBBBBBBBBB..',
    '...BB.BBBB.BB...',
    '................',
    '................',
    '................',
  ],
  [ // 네모 찐빵
    '................',
    '..BBBBBBBBBBBB..',
    '.BBBBBBBBBBBBBB.',
    '.BBBBBBBBBBBBBB.',
    '.BBBBBBBBBBBBBB.',
    '.BBBBBBBBBBBBBB.',
    '.BBBBBBBBBBBBBB.',
    '.BBBBBBBBBBBBBB.',
    '.BBBBBBBBBBBBBB.',
    '.BBBBBBBBBBBBBB.',
    '.BBBBBBBBBBBBBB.',
    '..BBBBBBBBBBBB..',
    '...BB.BBBB.BB...',
    '................',
    '................',
    '................',
  ],
  [ // 달걀
    '................',
    '.....BBBBBB.....',
    '....BBBBBBBB....',
    '...BBBBBBBBBB...',
    '..BBBBBBBBBBBB..',
    '..BBBBBBBBBBBB..',
    '.BBBBBBBBBBBBBB.',
    '.BBBBBBBBBBBBBB.',
    '.BBBBBBBBBBBBBB.',
    '.BBBBBBBBBBBBBB.',
    '..BBBBBBBBBBBB..',
    '..BBBBBBBBBBBB..',
    '...BB.BBBB.BB...',
    '................',
    '................',
    '................',
  ],
]

type Stamp = [row: number, col: number, ch: string][]

// 눈 4종 (E=눈동자, W=흰자/반짝)
const EYES: Stamp[] = [
  [[6, 4, 'E'], [6, 11, 'E']], // 점눈
  [[6, 4, 'E'], [5, 5, 'W'], [6, 11, 'E'], [5, 10, 'W']], // 반짝
  [[6, 3, 'E'], [6, 4, 'E'], [6, 11, 'E'], [6, 12, 'E']], // 졸린 가로눈
  [[6, 4, 'E'], [6, 10, 'E'], [6, 11, 'E'], [6, 12, 'E']], // 윙크
]

// 입 4종 (M)
const MOUTHS: Stamp[] = [
  [[9, 7, 'M'], [9, 8, 'M']], // 미소
  [[9, 7, 'M'], [9, 8, 'M'], [10, 7, 'M'], [10, 8, 'M']], // 아-
  [[9, 6, 'M'], [10, 7, 'M'], [9, 8, 'M']], // :3
  [[9, 7, 'M']], // 무표정
]

// 볼터치 2종 (C)
const CHEEKS: Stamp[] = [
  [[8, 3, 'C'], [8, 12, 'C']],
  [],
]

// 액세서리 5종 (A)
const ACCESSORIES: Stamp[] = [
  [], // 없음
  [[0, 7, 'A'], [1, 6, 'A'], [1, 8, 'A'], [0, 8, 'A']], // 리본
  [[0, 8, 'A'], [1, 8, 'A'], [0, 7, 'A']], // 새싹
  [[0, 5, 'A'], [0, 6, 'A'], [0, 7, 'A'], [0, 8, 'A'], [0, 9, 'A'], [0, 10, 'A'], [1, 7, 'A'], [1, 8, 'A']], // 모자
  [[0, 7, 'A'], [1, 6, 'A'], [1, 8, 'A'], [2, 7, 'A']], // 별
]

const ACCESSORY_COLORS = ['#f08c5a', '#56b58c', '#5a9cf0', '#e6b800', '#8f6fc0']

export interface Avatar {
  map: string[]
  palette: Record<string, string>
}

export function generateAvatar(answers: string[], salt: number): Avatar {
  const seed = hashSeed(answers.map((a) => a.trim()).join('') + ':' + String(salt))
  const pick = (n: number, shift: number) => (seed >>> shift) % n

  const color = BODY_COLORS[pick(BODY_COLORS.length, 0)]
  const shape = BODY_SHAPES[pick(BODY_SHAPES.length, 4)]
  const eyes = EYES[pick(EYES.length, 8)]
  const mouth = MOUTHS[pick(MOUTHS.length, 12)]
  const cheeks = CHEEKS[pick(CHEEKS.length, 16)]
  const accessory = ACCESSORIES[pick(ACCESSORIES.length, 20)]
  const accessoryColor = ACCESSORY_COLORS[pick(ACCESSORY_COLORS.length, 24)]

  const grid = shape.map((row) => row.split(''))
  const stampAll = (stamp: Stamp) => {
    for (const [r, c, ch] of stamp) grid[r][c] = ch
  }
  // 몸 최하단 픽셀에 음영
  for (let c = 0; c < 16; c++) {
    for (let r = 15; r >= 0; r--) {
      if (grid[r][c] === 'B') {
        grid[r][c] = 'S'
        break
      }
    }
  }
  stampAll(eyes)
  stampAll(mouth)
  stampAll(cheeks)
  stampAll(accessory)

  return {
    map: grid.map((row) => row.join('')),
    palette: {
      B: color.B,
      S: color.S,
      C: color.C,
      E: '#333333',
      W: '#ffffff',
      M: '#a2574f',
      A: accessoryColor,
    },
  }
}
