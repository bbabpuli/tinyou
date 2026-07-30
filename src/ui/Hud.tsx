import { happinessFrom } from '../domain/happiness'
import { levelForXp, xpIntoLevel } from '../domain/level'
import { selectLastCaredAt, selectXp, useGame } from '../state/store'

const MOOD_LABEL = { happy: '행복해요 🥰', ok: '무난해요 🙂', sad: '시무룩… 🥺', grimy: '꼬질꼬질… 🫠' }

export function Hud() {
  const xp = useGame(selectXp)
  const last = useGame(selectLastCaredAt)
  const level = levelForXp(xp)
  const { current, needed } = xpIntoLevel(xp)
  const mood = happinessFrom(last, new Date())
  return (
    <div style={{ fontFamily: 'monospace', textAlign: 'center' }}>
      <div>Lv.{level} — {MOOD_LABEL[mood]}</div>
      <progress value={current} max={needed} style={{ width: '100%' }} />
    </div>
  )
}
