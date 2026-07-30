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
