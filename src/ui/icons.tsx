/**
 * 프로젝트 자체 제작 픽셀 아이콘 — 외부 아이콘 팩 대신 블롭 스프라이트처럼 코드로 그린다.
 * (라이선스 이슈 없음, 둥근모꼴·LCD 도트 감성과 동일한 언어)
 * fill=currentColor라 놓인 곳의 글자색(셸 텍스트/베젤)을 그대로 따라간다.
 */

type Glyph = string[]

// '#' = 채움, '.' = 투명. 행 길이는 글리프 안에서 동일해야 한다.
const GLYPHS = {
  /** 주먹밥 — 밥 주기 */
  rice: [
    '.....##.....',
    '....#..#....',
    '...#....#...',
    '..#......#..',
    '.#........#.',
    '.#........#.',
    '#..........#',
    '#...####...#',
    '#...####...#',
    '.#........#.',
    '..########..',
  ],
  /** 하트 — 쓰다듬기 (쓰담 하트 파티클과 같은 언어) */
  heart: [
    '..##....##..',
    '.####..####.',
    '############',
    '############',
    '############',
    '.##########.',
    '..########..',
    '...######...',
    '....####....',
    '.....##.....',
  ],
  /** 초승달+별 — 굿나잇 */
  moon: [
    '....####....',
    '..######....',
    '.#####......',
    '.####....#..',
    '#####...###.',
    '#####....#..',
    '#####.......',
    '.####.......',
    '.#####......',
    '..######....',
    '....####....',
  ],
  /** 봉투 — 쪽지 */
  mail: [
    '############',
    '#..........#',
    '##........##',
    '#.##....##.#',
    '#...#..#...#',
    '#....##....#',
    '#..........#',
    '#..........#',
    '############',
  ],
  /** 화난 눈+앙다문 입 + 우상단 빠직 스파크(//) — 쓰담 스팸 시 말풍선에 뜬다 (빨강 권장) */
  angry: [
    '..............#.#.',
    '.............#.#..',
    '............#.#...',
    '...........#.#....',
    '##......##........',
    '.##....##.........',
    '..##..##..........',
    '..................',
    '.########.........',
    '.#.#..#.#.........',
  ],
  /** 슬라이더 — 설정 */
  gear: [
    '...##.......',
    '############',
    '...##.......',
    '............',
    '........##..',
    '############',
    '........##..',
    '............',
    '.##.........',
    '############',
    '.##.........',
  ],
} satisfies Record<string, Glyph>

interface IconProps {
  /** 표시 너비(px). 높이는 글리프 비율대로 */
  size?: number
  /** 접근성 라벨 — 없으면 장식용(aria-hidden) */
  label?: string
}

function PixelIcon({ glyph, size = 16, label }: IconProps & { glyph: keyof typeof GLYPHS }) {
  const rows = GLYPHS[glyph]
  const w = rows[0].length
  const h = rows.length
  return (
    <svg
      width={size}
      height={(size * h) / w}
      viewBox={`0 0 ${w} ${h}`}
      shapeRendering="crispEdges"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      style={{ verticalAlign: '-0.12em' }}
    >
      {rows.flatMap((row, y) =>
        [...row].map((c, x) =>
          c === '#' ? <rect key={`${x},${y}`} x={x} y={y} width={1} height={1} fill="currentColor" /> : null,
        ),
      )}
    </svg>
  )
}

export const IconRice = (p: IconProps) => <PixelIcon glyph="rice" {...p} />
export const IconHeart = (p: IconProps) => <PixelIcon glyph="heart" {...p} />
export const IconMoon = (p: IconProps) => <PixelIcon glyph="moon" {...p} />
export const IconMail = (p: IconProps) => <PixelIcon glyph="mail" {...p} />
export const IconAngry = (p: IconProps) => <PixelIcon glyph="angry" {...p} />
export const IconGear = (p: IconProps) => <PixelIcon glyph="gear" {...p} />
