export interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  lifeMs: number
}

const LIFE_MS = 1200
// 5×4 픽셀 하트 (1 = 채움)
const HEART = [
  [0, 1, 0, 1, 0],
  [1, 1, 1, 1, 1],
  [0, 1, 1, 1, 0],
  [0, 0, 1, 0, 0],
]

export class ParticleSystem {
  particles: Particle[] = []

  constructor(private rng: () => number = Math.random) {}

  get count(): number {
    return this.particles.length
  }

  spawnHearts(x: number, y: number, count = 5): void {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: x + (this.rng() - 0.5) * 16,
        y,
        vx: (this.rng() - 0.5) * 30,
        vy: -40 - this.rng() * 20,
        lifeMs: LIFE_MS,
      })
    }
  }

  update(dtMs: number): void {
    const dt = dtMs / 1000
    for (const p of this.particles) {
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.lifeMs -= dtMs
    }
    this.particles = this.particles.filter((p) => p.lifeMs > 0)
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#ff6b9d'
    for (const p of this.particles) {
      ctx.globalAlpha = Math.min(1, p.lifeMs / LIFE_MS + 0.2)
      for (let row = 0; row < HEART.length; row++) {
        for (let col = 0; col < HEART[row].length; col++) {
          if (HEART[row][col]) ctx.fillRect(Math.round(p.x) + col, Math.round(p.y) + row, 1, 1)
        }
      }
    }
    ctx.globalAlpha = 1
  }
}
