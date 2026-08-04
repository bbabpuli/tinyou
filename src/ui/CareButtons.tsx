import { useMemo } from 'react'
import { canCareToday, canPetStackToday } from '../domain/care'
import { canFeedNow, hoursUntilHungry, lastFedAt } from '../domain/hunger'
import { isGoodnightWindow } from '../game/night'
import { useTick } from '../hooks/useTick'
import { useGame } from '../state/store'

export function CareButtons({ onPetSent }: { onPetSent?: () => void }) {
  useTick(60_000) // 배고픔·자정(Asia/Seoul)·굿나잇 창이 시간만으로 바뀌므로 클릭 없이도 재반영돼야 한다
  const care = useGame((s) => s.care)
  const careLog = useGame((s) => s.careLog)
  const userId = useGame((s) => s.userId)
  const now = new Date()
  const feedable = useMemo(() => !!userId && canFeedNow(careLog, now), [careLog, userId, now])
  const untilHungry = useMemo(() => hoursUntilHungry(lastFedAt(careLog), now), [careLog, now])
  const petStackLeft = useMemo(
    () => !!userId && canPetStackToday(careLog, userId, now),
    [careLog, userId, now],
  )
  const showGoodnight = isGoodnightWindow(now)
  const canGoodnight = useMemo(
    () => !!userId && canCareToday(careLog, userId, 'goodnight', now),
    [careLog, userId, now],
  )
  const handlePet = async () => {
    if (await care('pet')) onPetSent?.()
  }
  return (
    <div style={{ display: 'grid', gap: 4, justifyItems: 'center' }}>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
        <button disabled={!feedable} onClick={() => care('feed')}>🍙 밥 주기</button>
        <button disabled={!userId} onClick={handlePet}>🫳 쓰다듬기</button>
        {showGoodnight && (
          <button disabled={!canGoodnight} onClick={() => care('goodnight')}>🌙 굿나잇 인사</button>
        )}
      </div>
      {!feedable && userId && (
        <small style={{ color: '#888' }}>아직 배불러요 — 약 {untilHungry}시간 후에 배고파져요</small>
      )}
      {!petStackLeft && userId && (
        <small style={{ color: '#888' }}>오늘 쓰다듬기 XP는 다 모았어요 — 그래도 계속 쓰다듬을 수 있어요 🫶</small>
      )}
    </div>
  )
}
