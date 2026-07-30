export function startLoop(cb: (dtMs: number) => void): () => void {
  let raf = 0
  let last = performance.now()
  const tick = (now: number) => {
    const dt = Math.min(now - last, 100) // 탭 복귀 시 폭주 방지
    last = now
    cb(dt)
    raf = requestAnimationFrame(tick)
  }
  raf = requestAnimationFrame(tick)
  return () => cancelAnimationFrame(raf)
}
