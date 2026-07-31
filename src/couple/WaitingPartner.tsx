interface WaitingPartnerProps {
  inviteCode: string | null
  onRefresh: () => void
}

/** 방은 만들었지만 연인이 아직 합류하지 않은 상태 — 초대 코드를 언제든 다시 볼 수 있다. */
export function WaitingPartner({ inviteCode, onRefresh }: WaitingPartnerProps) {
  return (
    <div style={{ display: 'grid', gap: 12, textAlign: 'center' }}>
      <h2>연인을 기다리는 중이에요 💌</h2>
      <p>연인에게 이 코드를 보내주세요</p>
      {inviteCode ? (
        <strong style={{ fontSize: 40, letterSpacing: 6, fontFamily: 'monospace' }}>
          {inviteCode}
        </strong>
      ) : (
        <p style={{ color: 'crimson' }}>초대 코드를 불러오지 못했어요</p>
      )}
      <p style={{ fontSize: 13, opacity: 0.7 }}>코드는 24시간 유효해요</p>
      <button onClick={onRefresh}>들어왔는지 확인 🔄 (자동으로도 넘어가요)</button>
    </div>
  )
}
