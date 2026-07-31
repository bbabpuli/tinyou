import { useEffect } from 'react'
import { LoginScreen } from './auth/LoginScreen'
import { useSession } from './auth/useSession'
import { CharacterCreate } from './character/CharacterCreate'
import { useCharacters } from './character/useCharacters'
import { CoupleSetup } from './couple/CoupleSetup'
import { useCouple } from './couple/useCouple'
import { WaitingPartner } from './couple/WaitingPartner'
import { useGame } from './state/store'
import { AvatarGallery } from './ui/AvatarGallery'
import { CareButtons } from './ui/CareButtons'
import { Hud } from './ui/Hud'
import { Stage } from './ui/Stage'

export function App() {
  if (new URLSearchParams(window.location.search).has('gallery')) return <AvatarGallery />
  return <MainApp />
}

function MainApp() {
  const { session, loading: authLoading } = useSession()
  const userId = session?.user.id
  const { couple, loading: coupleLoading, refresh: refreshCouple } = useCouple(userId)
  const { mine, loading: charLoading, refresh: refreshChars } = useCharacters(
    couple?.coupleId,
    userId,
  )
  const loadCare = useGame((s) => s.loadCare)
  const mineId = mine?.id

  useEffect(() => {
    if (mineId && userId) void loadCare(mineId, userId)
  }, [mineId, userId, loadCare])

  let body
  if (authLoading || (userId && (coupleLoading || charLoading))) body = <p>불러오는 중…</p>
  else if (!session) body = <LoginScreen />
  else if (!couple) body = <CoupleSetup onDone={refreshCouple} />
  // 연인이 아직 합류하지 않았으면 캐릭터 생성(파트너 필요)을 막고 초대 코드를 계속 보여준다
  else if (!couple.partner)
    body = <WaitingPartner inviteCode={couple.inviteCode} onRefresh={refreshCouple} />
  else if (!mine || !mine.name) body = <CharacterCreate onDone={refreshChars} />
  else body = (
    <>
      <Stage character={mine} />
      <Hud character={mine} />
      <CareButtons />
    </>
  )

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: 16, display: 'grid', gap: 12 }}>
      <h1 style={{ fontFamily: 'monospace', textAlign: 'center' }}>Tinyou</h1>
      {body}
    </main>
  )
}
