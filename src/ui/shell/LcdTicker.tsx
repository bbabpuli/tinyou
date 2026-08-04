import { useMemo } from 'react'
import { canPetStackToday } from '../../domain/care'
import { canFeedNow, hoursUntilHungry, lastFedAt } from '../../domain/hunger'
import { useTick } from '../../hooks/useTick'
import { useGame } from '../../state/store'

/** LCD 하단 안내줄 — 배부름·쓰담 스택 상태를 기기 화면 안에서 알려준다. */
export function LcdTicker() {
  useTick(60_000)
  const careLog = useGame((s) => s.careLog)
  const userId = useGame((s) => s.userId)
  const now = new Date()
  const lines = useMemo(() => {
    if (!userId) return []
    const out: string[] = []
    if (!canFeedNow(careLog, now)) {
      out.push(`아직 배불러요 · 약 ${hoursUntilHungry(lastFedAt(careLog), now)}시간 후 배고파져요`)
    }
    if (!canPetStackToday(careLog, userId, now)) {
      out.push('오늘 쓰담 XP 완료 · 그래도 계속 쓰다듬을 수 있어요')
    }
    return out
  }, [careLog, userId, now])
  return (
    <div className="lcd-ticker">
      {lines.map((l) => (
        <div key={l}>{l}</div>
      ))}
    </div>
  )
}
