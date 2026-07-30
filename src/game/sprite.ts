// 임시 분신: 12×9 분홍 블롭. Plan 2에서 AI 생성 이미지로 교체된다.
export const BLOB_MAP: string[] = [
  '...PPPPPP...',
  '..PPPPPPPP..',
  '.PPWBPPWBPP.',
  '.PPWWPPWWPP.',
  'PPPPPPPPPPPP',
  'PPPPPCCPPPPP',
  'PPPPCCCCPPPP',
  '.PPPPPPPPPP.',
  '..PP..PP....',
]

export const PALETTE_NORMAL: Record<string, string> = {
  P: '#ffb7c9', // 몸통 분홍
  W: '#ffffff', // 눈 흰자
  B: '#333333', // 눈동자
  C: '#ff6b9d', // 볼터치/입
}

export const PALETTE_GRIMY: Record<string, string> = {
  P: '#c9b8bd',
  W: '#eeeeee',
  B: '#555555',
  C: '#a98a94',
}

export function drawPixelMap(
  ctx: CanvasRenderingContext2D,
  map: string[],
  palette: Record<string, string>,
  x: number,
  y: number,
  scale: number,
): void {
  for (let row = 0; row < map.length; row++) {
    for (let col = 0; col < map[row].length; col++) {
      const color = palette[map[row][col]]
      if (!color) continue
      ctx.fillStyle = color
      ctx.fillRect(x + col * scale, y + row * scale, scale, scale)
    }
  }
}
