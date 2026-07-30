import { useState } from 'react'
import { supabase } from '../lib/supabase'

export function LoginScreen() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const send = async () => {
    setError(null)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    })
    if (error) setError(error.message)
    else setSent(true)
  }

  return (
    <div style={{ display: 'grid', gap: 12, textAlign: 'center' }}>
      <h2>티뉴에 어서오세요 🐣</h2>
      {sent ? (
        <p>메일함을 확인해주세요! 로그인 링크를 보냈어요.</p>
      ) : (
        <>
          <input
            type="email"
            placeholder="이메일 주소"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button disabled={!email.includes('@')} onClick={send}>
            로그인 링크 받기 ✉️
          </button>
          {error && <p style={{ color: 'crimson' }}>{error}</p>}
        </>
      )}
    </div>
  )
}
