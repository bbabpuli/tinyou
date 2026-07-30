export interface Walker {
  readonly x: number
  readonly facing: 1 | -1
  update(dtMs: number, walking: boolean): void
}

/** 캐릭터의 영속 x좌표. 상태가 바뀌어도 x를 기억해 전이 순간이동을 없앤다. */
export function createWalker(opts: {
  initialX: number
  minX: number
  maxX: number
  speedPxPerSec?: number
}): Walker {
  const { minX, maxX, speedPxPerSec = 40 } = opts
  let x = opts.initialX
  let facing: 1 | -1 = 1

  return {
    get x() {
      return x
    },
    get facing() {
      return facing
    },
    update(dtMs, walking) {
      if (!walking) return
      // 이동 폭이 없으면(좁은 화면 등으로 minX >= maxX) while 루프가 dist=0으로 진행되지 않아
      // 무한루프에 빠진다 — 아예 이동하지 않고 빠져나간다.
      if (minX >= maxX) return
      let remain = (dtMs / 1000) * speedPxPerSec
      while (remain > 0) {
        const target = facing === 1 ? maxX : minX
        const dist = Math.abs(target - x)
        if (remain < dist) {
          x += facing * remain
          remain = 0
        } else {
          x = target
          remain -= dist
          facing = facing === 1 ? -1 : 1
        }
      }
    },
  }
}
