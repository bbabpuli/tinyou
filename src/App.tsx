import type { CharacterRow } from './character/useCharacters'
import { CareButtons } from './ui/CareButtons'
import { Hud } from './ui/Hud'
import { Stage } from './ui/Stage'

// Task 10(라우팅 조립)에서 useSession + useCharacters로 교체될 임시 플레이그라운드 캐릭터.
const PLACEHOLDER_CHARACTER: CharacterRow = {
  id: 'playground',
  ownerUserId: 'me',
  name: null,
  imageUrl: null,
  regenCount: 0,
}

export function App() {
  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: 16, display: 'grid', gap: 12 }}>
      <h1 style={{ fontFamily: 'monospace', textAlign: 'center' }}>Tinyou</h1>
      <Stage character={PLACEHOLDER_CHARACTER} />
      <Hud character={PLACEHOLDER_CHARACTER} />
      <CareButtons />
    </main>
  )
}
