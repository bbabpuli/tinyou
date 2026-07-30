import { useState } from 'react'
import { supabase } from '../lib/supabase'

export function CoupleSetup({ onDone }: { onDone: () => void }) {
  const [nickname, setNickname] = useState('')
  const [mode, setMode] = useState<'menu' | 'created' | 'join'>('menu')
  const [code, setCode] = useState('')
  const [myCode, setMyCode] = useState('')
  const [error, setError] = useState<string | null>(null)

  const create = async () => {
    setError(null)
    const { data, error } = await supabase.rpc('create_couple', { p_nickname: nickname })
    if (error) setError(error.message)
    else {
      setMyCode(data as string)
      setMode('created')
    }
  }

  const join = async () => {
    setError(null)
    const { error } = await supabase.rpc('join_couple', { p_code: code, p_nickname: nickname })
    if (error) {
      const msg = error.message.includes('INVALID_CODE')
        ? '코드를 다시 확인해주세요'
        : error.message.includes('COUPLE_FULL')
          ? '이미 두 명이 함께하고 있는 방이에요'
          : error.message
      setError(msg)
    } else onDone()
  }

  return (
    <div style={{ display: 'grid', gap: 12, textAlign: 'center' }}>
      <h2>둥지 만들기 🪺</h2>
      <input placeholder="내 닉네임" value={nickname} onChange={(e) => setNickname(e.target.value)} />
      {mode === 'menu' && (
        <>
          <button disabled={!nickname} onClick={create}>새 둥지 만들기</button>
          <button disabled={!nickname} onClick={() => setMode('join')}>초대 코드로 합류</button>
        </>
      )}
      {mode === 'created' && (
        <>
          <p>연인에게 이 코드를 보내주세요:</p>
          <strong style={{ fontSize: 32, letterSpacing: 4 }}>{myCode}</strong>
          <button onClick={onDone}>연인이 들어왔어요 →</button>
        </>
      )}
      {mode === 'join' && (
        <>
          <input placeholder="6자리 코드" value={code} maxLength={6}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
          <button disabled={code.length !== 6} onClick={join}>합류하기</button>
        </>
      )}
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
    </div>
  )
}
