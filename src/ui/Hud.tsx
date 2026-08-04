import { useMemo } from 'react'
import type { CharacterRow } from '../character/useCharacters'
import { happinessFrom } from '../domain/happiness'
import { hungerFrom, lastFedAt } from '../domain/hunger'
import { levelForXp, xpIntoLevel } from '../domain/level'
import { useTick } from '../hooks/useTick'
import { selectLastCaredAt, selectXp, useGame } from '../state/store'

const MOOD_LABEL = { happy: '행복', ok: '무난', sad: '시무룩', grimy: '꼬질꼬질' }
const HUNGER_LABEL = { full: '배불러요', ok: '출출해요', hungry: '배고파요' }

interface HudProps {
  character: CharacterRow
}

/** LCD 상단 상태줄 + XP 게이지 — 기기 화면의 계기판. Lcd 컨테이너 안에서 렌더된다. */
export function Hud({ character }: HudProps) {
  useTick(60_000) // 방치 시간이 흐르면 돌봄 없이도 기분·배고픔 라벨이 바뀐다
  const careLog = useGame((s) => s.careLog) // 안정적인 참조 — selectXp/selectLastCaredAt 결과를 직접 구독하면 매 렌더 새 값이라 무한 루프
  const xp = useMemo(() => selectXp({ careLog }), [careLog])
  const last = useMemo(() => selectLastCaredAt({ careLog }), [careLog])
  const level = levelForXp(xp)
  const { current, needed } = xpIntoLevel(xp)
  const now = new Date()
  const mood = happinessFrom(last, now)
  const hunger = hungerFrom(lastFedAt(careLog), now)
  const name = character.name ?? '이름 없음'
  return (
    <>
      <div className="lcd-status">
        <span>Lv.{level} {name}</span>
        <span>{MOOD_LABEL[mood]} · {HUNGER_LABEL[hunger]}</span>
      </div>
      <div
        className="lcd-gauge"
        role="progressbar"
        aria-valuenow={current}
        aria-valuemax={needed}
        aria-label="경험치"
      >
        <div style={{ width: `${Math.min(100, (current / needed) * 100)}%` }} />
      </div>
    </>
  )
}
