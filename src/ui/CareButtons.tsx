import { useMemo } from 'react'
import { canCareToday } from '../domain/care'
import { canFeedNow } from '../domain/hunger'
import { isGoodnightWindow } from '../game/night'
import { useTick } from '../hooks/useTick'
import { useGame } from '../state/store'
import { IconHeart, IconMoon, IconRice } from './icons'
import { DeviceButton } from './shell/DeviceButton'

/**
 * 셸의 물리 버튼 3개. 상태 안내(배부름·스택)는 LcdTicker가 기기 화면 안에서 담당한다.
 * 굿나잇은 창 밖 시간에도 사라지지 않고 비활성 — 물리 버튼은 뽑았다 꽂는 게 아니다.
 */
export function CareButtons({ onPetSent }: { onPetSent?: () => void }) {
  useTick(60_000) // 배고픔·자정(Asia/Seoul)·굿나잇 창이 시간만으로 바뀌므로 클릭 없이도 재반영돼야 한다
  const care = useGame((s) => s.care)
  const careLog = useGame((s) => s.careLog)
  const userId = useGame((s) => s.userId)
  const now = new Date()
  const feedable = useMemo(() => !!userId && canFeedNow(careLog, now), [careLog, userId, now])
  const goodnightOpen = isGoodnightWindow(now)
  const canGoodnight = useMemo(
    () => goodnightOpen && !!userId && canCareToday(careLog, userId, 'goodnight', now),
    [careLog, userId, goodnightOpen, now],
  )
  const handlePet = async () => {
    if (await care('pet')) onPetSent?.()
  }
  return (
    <div className="device-buttons">
      <DeviceButton icon={<IconRice size={26} />} label="밥" disabled={!feedable} onClick={() => void care('feed')} />
      <DeviceButton icon={<IconHeart size={26} />} label="쓰담" disabled={!userId} onClick={() => void handlePet()} />
      <DeviceButton icon={<IconMoon size={26} />} label="굿나잇" disabled={!canGoodnight} onClick={() => void care('goodnight')} />
    </div>
  )
}
