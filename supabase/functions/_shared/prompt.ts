// Edge Function(Deno)과 Vitest가 공유 — Deno/Node 전용 API 사용 금지
export function buildCharacterPrompt(answers: string[]): string {
  const description = answers
    .map((a) => a.trim())
    .filter((a) => a.length > 0)
    .join('. ')
  const subject = description.length > 0 ? `${description}. ` : ''
  return (
    `cute pixel art character portrait, chibi proportions, ${subject}` +
    `simple shapes, soft pastel colors, friendly face, 64x64 retro game sprite style, ` +
    `single character centered, plain background`
  )
}
