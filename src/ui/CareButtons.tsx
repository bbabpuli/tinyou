import { canCareToday } from '../domain/care'
import { PLAYER_ID, selectActions, useGame } from '../state/store'

export function CareButtons() {
  const care = useGame((s) => s.care)
  const actions = useGame(selectActions) // careLog 변경 시 자동 리렌더
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
