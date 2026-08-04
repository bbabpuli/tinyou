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
import { usePetChannel } from './realtime/usePetChannel'
import { useGame } from './state/store'
import { applyPetEvent, type PetToastState } from './traces/petToast'
import { TraceToast } from './traces/TraceToast'
import { AvatarGallery } from './ui/AvatarGallery'
import { CareButtons } from './ui/CareButtons'
import { Hud } from './ui/Hud'
import { PetToast } from './ui/PetToast'
import { SettingsCorner } from './ui/SettingsCorner'
import { Shell } from './ui/shell/Shell'
import { shellThemeFor } from './ui/shell/shellTheme'
import { LcdTicker } from './ui/shell/LcdTicker'
import { Tray } from './ui/shell/Tray'
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
  useCoupleChannel(couple?.coupleId, userId, {
    onMessage: refreshMessages,
    onCare: () => {
      if (mineId && userId) void loadCare(mineId, userId)
    },
    onProfile: refreshCouple,
  })

  // 쓰다듬 실시간 토스트 — 수신 상태는 여기서 들고, 표시 판정은 PetToast가 한다
  const [petToast, setPetToast] = useState<PetToastState | null>(null)
  const partnerNickname = couple?.partner?.nickname
  const { sendPet } = usePetChannel(couple?.coupleId, userId, () => {
    setPetToast((s) => applyPetEvent(s, partnerNickname ?? '연인', Date.now()))
  })

  // 대기 화면은 Realtime에만 기대지 않는다: 구독이 실패하면 "연인이 들어오면 자동으로 넘어가요"
  // 약속이 깨지므로, 파트너가 없는 동안만 5초 폴링으로 직접 확인한다. 파트너가 생기면 정리된다.
  const waitingForPartner = Boolean(couple && !couple.partner)
  useEffect(() => {
    if (!waitingForPartner) return
    const timer = setInterval(() => {
      void refreshCouple()
    }, 5000)
    return () => clearInterval(timer)
  }, [waitingForPartner, refreshCouple])

  // 메인 화면(분신이 있는 상태)인지 — 셸 레이아웃이 LCD+버튼+트레이 풀셋인지, LCD 카드 하나인지 가른다
  const onStage = Boolean(
    session && couple?.partner && mine && mine.name && !redecorating,
  )
  // 셸 색은 내 화면에 사는 분신(연인의 분신)의 팔레트를 따른다. 없으면 크림 기본
  const theme = shellThemeFor(onStage ? mine?.paletteKey : null)

  // 보조 화면(로그인·커플·생성·로딩)의 내용 — LCD 카드 하나에 담긴다
  let cardBody = null
  if (!onStage) {
    if (authLoading || (userId && ((coupleLoading && !couple) || (charLoading && !mine))))
      cardBody = <p style={{ textAlign: 'center', margin: 0 }}>불러오는 중…</p>
    else if (!session) cardBody = <LoginScreen />
    else if (!couple) cardBody = <CoupleSetup onDone={refreshCouple} />
    // 연인이 아직 합류하지 않았으면 캐릭터 생성(파트너 필요)을 막고 초대 코드를 계속 보여준다
    else if (!couple.partner)
      cardBody = <WaitingPartner inviteCode={couple.inviteCode} onRefresh={refreshCouple} />
    else if (!mine || !mine.name) cardBody = <CharacterCreate onDone={refreshChars} />
    // 새 v2 아바타로 아직 단장하지 않은 기존 캐릭터(regenCount === 0)는 답변을 새로 받아 재생성한다
    else if (redecorating)
      cardBody = (
        <>
          {/* 단장은 되돌릴 수 없는 재생성이라 언제든 빠져나올 길을 열어둔다 */}
          <button
            onClick={() => setRedecorating(false)}
            style={{ justifySelf: 'start', background: 'none', border: 'none', boxShadow: 'none' }}
          >
            나중에 할래요 ↩
          </button>
          <CharacterCreate
            onDone={() => {
              // 리페치가 끝난 뒤에 스테이지로 전환해야 옛 regenCount=0으로 배너가 재표시되지 않는다
              void refreshChars().then(() => setRedecorating(false))
            }}
          />
        </>
      )
  }

  return (
    <Shell theme={theme}>
      {onStage && mine && couple?.partner ? (
        <>
          {mine.regenCount === 0 && <RedecorateBanner onClick={() => setRedecorating(true)} />}
          <TraceToast
            partnerCharacterId={partners?.id ?? null}
            partnerId={couple.partner.userId}
            partnerNickname={couple.partner.nickname}
          />
          <PetToast state={petToast} />
          <div className="lcd">
            <Hud character={mine} />
            <Stage character={mine} unread={unread} markRead={markRead} />
            <LcdTicker />
          </div>
          <CareButtons onPetSent={sendPet} />
          <Tray unreadCount={unread.length}>
            <div>
              <div className="tray-section-label">쪽지 보내기</div>
              <SendNote send={send} />
            </div>
            <div>
              <div className="tray-section-label">받은 쪽지</div>
              <Inbox inbox={inbox} />
            </div>
            {session && <SettingsCorner />}
          </Tray>
        </>
      ) : (
        <div className="lcd-card">{cardBody}</div>
      )}
    </Shell>
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
        width: '100%',
        padding: '8px 12px',
        marginBottom: 10,
        borderRadius: 10,
        border: '2px solid var(--lcd-bezel)',
        background: 'var(--paper)',
        color: 'var(--lcd-bezel)',
        fontSize: 14,
      }}
    >
      <span>분신이 새 모습으로 단장하고 싶어해요 ✨</span>
      <button onClick={onClick}>단장하기</button>
    </div>
  )
}
