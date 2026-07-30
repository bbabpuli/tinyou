import { useMemo } from 'react'
import { canCareToday } from '../domain/care'
import { useTick } from '../hooks/useTick'
import { PLAYER_ID, selectActions, useGame } from '../state/store'

export function CareButtons() {
  useTick(60_000) // 자정(Asia/Seoul)이 지나면 클릭 없이도 버튼이 다시 활성화돼야 한다
  const care = useGame((s) => s.care)
  const careLog = useGame((s) => s.careLog) // 안정적인 참조 — selectActions 결과를 직접 구독하면 매 렌더 새 배열이라 무한 루프
  const actions = useMemo(() => selectActions({ careLog }), [careLog])
  const now = new Date()
  const canFeed = canCareToday(actions, PLAYER_ID, 'feed', now)
  const canPet = canCareToday(actions, PLAYER_ID, 'pet', now)
  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
      <button disabled={!canFeed} onClick={() => care('feed')}>🍙 밥 주기</button>
      <button disabled={!canPet} onClick={() => care('pet')}>🫳 쓰다듬기</button>
    </div>
  )
}
