import { useMemo } from 'react'
import { canCareToday } from '../domain/care'
import { useTick } from '../hooks/useTick'
import { useGame } from '../state/store'

export function CareButtons() {
  useTick(60_000) // 자정(Asia/Seoul)이 지나면 클릭 없이도 버튼이 다시 활성화돼야 한다
  const care = useGame((s) => s.care)
  const careLog = useGame((s) => s.careLog)
  const userId = useGame((s) => s.userId)
  const now = new Date()
  const canFeed = useMemo(
    () => !!userId && canCareToday(careLog, userId, 'feed', now),
    [careLog, userId, now],
  )
  const canPet = useMemo(
    () => !!userId && canCareToday(careLog, userId, 'pet', now),
    [careLog, userId, now],
  )
  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
      <button disabled={!canFeed} onClick={() => care('feed')}>🍙 밥 주기</button>
      <button disabled={!canPet} onClick={() => care('pet')}>🫳 쓰다듬기</button>
    </div>
  )
}
