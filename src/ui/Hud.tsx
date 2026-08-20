import { useMemo } from 'react'
import type { CharacterRow } from '../character/useCharacters'
import { happinessFrom } from '../domain/happiness'
import { hungerFrom, lastFedAt } from '../domain/hunger'
import { levelForXp, xpIntoLevel } from '../domain/level'
import { useTick } from '../hooks/useTick'
import { selectLastCaredAt, selectXp, useGame } from '../state/store'

const MOOD_LABEL = { happy: '행복해요 🥰', ok: '무난해요 🙂', sad: '시무룩… 🥺', grimy: '꼬질꼬질… 🫠' }

const HUNGER_LABEL = { full: '배불러요 🍚', ok: '출출해요 🍙', hungry: '배고파요 🥣' }

interface HudProps {
  character: CharacterRow
}

export function Hud({ character }: HudProps) {
  useTick(60_000) // 방치 시간이 흐르면 돌봄 없이도 기분 라벨이 바뀐다
  const careLog = useGame((s) => s.careLog) // 안정적인 참조 — selectXp/selectLastCaredAt 결과를 직접 구독하면 매 렌더 새 값이라 무한 루프
  const xp = useMemo(() => selectXp({ careLog }), [careLog])
  const last = useMemo(() => selectLastCaredAt({ careLog }), [careLog])
  const level = levelForXp(xp)
  const { current, needed } = xpIntoLevel(xp)
  const mood = happinessFrom(last, new Date())
  const hunger = hungerFrom(lastFedAt(careLog), new Date())
  const name = character.name ?? '이름 없음'
  return (
    <div style={{ fontFamily: 'monospace', textAlign: 'center' }}>
      <div>Lv.{level} — {name} — {MOOD_LABEL[mood]} — {HUNGER_LABEL[hunger]}</div>
      <progress value={current} max={needed} style={{ width: '100%' }} />
    </div>
  )
}
