import { useEffect, useState } from 'react'

/**
 * ms 간격으로 리렌더를 유발하는 카운터.
 * 기분·버튼 활성처럼 "현재 시각"에서 파생되는 값은 이벤트 없이도 시간이 지나면 바뀌므로,
 * 이 훅으로 주기적 재계산을 강제한다.
 */
export function useTick(ms: number): number {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), ms)
    return () => clearInterval(id)
  }, [ms])
  return tick
}
