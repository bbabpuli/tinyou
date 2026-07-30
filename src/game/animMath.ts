export function bobY(tMs: number, amplitude = 2, periodMs = 800): number {
  return Math.sin((tMs / periodMs) * Math.PI * 2) * amplitude
}

export function chewSquash(progress: number, intensity = 0.15): { sx: number; sy: number } {
  const s = Math.abs(Math.sin(progress * Math.PI * 3)) * intensity
  return { sx: 1 + s, sy: 1 - s }
}

export function pingPong(
  tMs: number,
  speedPxPerSec: number,
  minX: number,
  maxX: number,
): { x: number; facing: 1 | -1 } {
  const range = maxX - minX
  const dist = (tMs / 1000) * speedPxPerSec
  const cycle = dist % (range * 2)
  if (cycle < range) return { x: minX + cycle, facing: 1 }
  return { x: maxX - (cycle - range), facing: -1 }
}

export function hopY(tMs: number, height = 8, periodMs = 500): number {
  return -Math.abs(Math.sin((tMs / periodMs) * Math.PI)) * height
}
