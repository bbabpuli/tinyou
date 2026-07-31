import { useState } from 'react'

const MAX_LEN = 140
const TOAST_MS = 2500

interface SendNoteProps {
  send: (body: string) => Promise<boolean>
}

export function SendNote({ send }: SendNoteProps) {
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [showToast, setShowToast] = useState(false)

  const onSend = async () => {
    const trimmed = body.trim()
    if (!trimmed || sending) return
    setSending(true)
    const ok = await send(trimmed)
    setSending(false)
    if (ok) {
      setBody('')
      setShowToast(true)
      setTimeout(() => setShowToast(false), TOAST_MS)
    }
  }

  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={body}
          maxLength={MAX_LEN}
          placeholder="분신에게 전할 마음을 적어주세요"
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void onSend()
          }}
          style={{ flex: 1 }}
        />
        <button disabled={!body.trim() || sending} onClick={() => void onSend()}>
          보내기
        </button>
      </div>
      {showToast && (
        <p style={{ textAlign: 'center', fontSize: 13, color: '#4a3f35' }}>
          분신이 배달하러 갔어요 💌
        </p>
      )}
    </div>
  )
}
