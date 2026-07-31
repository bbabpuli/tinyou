import { useEffect, useState } from 'react'
import { LoginScreen } from './auth/LoginScreen'
import { useSession } from './auth/useSession'
import { CharacterCreate } from './character/CharacterCreate'
import { useCharacters } from './character/useCharacters'
import { CoupleSetup } from './couple/CoupleSetup'
import { useCouple } from './couple/useCouple'
import { WaitingPartner } from './couple/WaitingPartner'
import { Inbox } from './messages/Inbox'
import { SendNote } from './messages/SendNote'
import { useMessages } from './messages/useMessages'
import { useCoupleChannel } from './realtime/useCoupleChannel'
import { useGame } from './state/store'
import { TraceToast } from './traces/TraceToast'
import { AvatarGallery } from './ui/AvatarGallery'
import { CareButtons } from './ui/CareButtons'
import { Hud } from './ui/Hud'
import { SettingsCorner } from './ui/SettingsCorner'
import { Stage } from './ui/Stage'

export function App() {
  if (new URLSearchParams(window.location.search).has('gallery')) return <AvatarGallery />
  return <MainApp />
}

function MainApp() {
  const { session, loading: authLoading } = useSession()
  const userId = session?.user.id
  const { couple, loading: coupleLoading, refresh: refreshCouple } = useCouple(userId)
  const { mine, partners, loading: charLoading, refresh: refreshChars } = useCharacters(
    couple?.coupleId,
    userId,
  )
  const loadCare = useGame((s) => s.loadCare)
  const mineId = mine?.id
  const [redecorating, setRedecorating] = useState(false)
  const { unread, inbox, send, markRead, refresh: refreshMessages } = useMessages(
    couple?.coupleId,
    userId,
  )

  useEffect(() => {
    if (mineId && userId) void loadCare(mineId, userId)
  }, [mineId, userId, loadCare])

  // 파트너의 돌봄/쪽지/합류를 실시간으로 반영 — 구독이 실패해도 각 refresh는 기존 fetch 그대로라 무해하다
  useCoupleChannel(couple?.coupleId, {
    onMessage: refreshMessages,
    onCare: () => {
      if (mineId && userId) void loadCare(mineId, userId)
    },
    onProfile: refreshCouple,
  })

  let body
  if (authLoading || (userId && (coupleLoading || charLoading))) body = <p>불러오는 중…</p>
  else if (!session) body = <LoginScreen />
  else if (!couple) body = <CoupleSetup onDone={refreshCouple} />
  // 연인이 아직 합류하지 않았으면 캐릭터 생성(파트너 필요)을 막고 초대 코드를 계속 보여준다
  else if (!couple.partner)
    body = <WaitingPartner inviteCode={couple.inviteCode} onRefresh={refreshCouple} />
  else if (!mine || !mine.name) body = <CharacterCreate onDone={refreshChars} />
  // 새 v2 아바타로 아직 단장하지 않은 기존 캐릭터(regenCount === 0)는 답변을 새로 받아 재생성한다
  else if (redecorating)
    body = (
      <CharacterCreate
        onDone={() => {
          setRedecorating(false)
          refreshChars()
        }}
      />
    )
  else body = (
    <>
      {mine.regenCount === 0 && <RedecorateBanner onClick={() => setRedecorating(true)} />}
      <TraceToast
        partnerCharacterId={partners?.id ?? null}
        partnerId={couple.partner.userId}
        partnerNickname={couple.partner.nickname}
      />
      <Stage character={mine} unread={unread} markRead={markRead} />
      <Hud character={mine} />
      <CareButtons />
      <SendNote send={send} />
      <Inbox inbox={inbox} />
    </>
  )

  return (
    <>
      {session && <SettingsCorner />}
      <main style={{ maxWidth: 480, margin: '0 auto', padding: 16, display: 'grid', gap: 12 }}>
        <h1 style={{ fontFamily: 'monospace', textAlign: 'center' }}>Tinyou</h1>
        {body}
      </main>
    </>
  )
}

function RedecorateBanner({ onClick }: { onClick: () => void }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        padding: '8px 12px',
        borderRadius: 8,
        background: '#fff3cd',
      }}
    >
      <span>분신이 새 모습으로 단장하고 싶어해요 ✨</span>
      <button onClick={onClick}>단장하러 가기</button>
    </div>
  )
}
