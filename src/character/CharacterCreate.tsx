import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { QUESTIONS } from './questions'

export function CharacterCreate({ onDone }: { onDone: () => void }) {
  const [answers, setAnswers] = useState<string[]>(QUESTIONS.map(() => ''))
  const [step, setStep] = useState<'cards' | 'preview'>('cards')
  const [busy, setBusy] = useState(false)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [remaining, setRemaining] = useState<number | null>(null)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)

  const generate = async () => {
    setBusy(true)
    setError(null)
    const { data, error } = await supabase.functions.invoke('generate-character', {
      body: { answers },
    })
    setBusy(false)
    let code: string = data?.error ?? ''
    if (error && !code) {
      const ctx = (error as { context?: Response }).context
      if (ctx) {
        try {
          code = ((await ctx.json()) as { error?: string }).error ?? ''
        } catch {
          // 본문이 JSON이 아니면 일반 실패로 처리
        }
      }
    }
    if (error || code) {
      setError(
        code === 'GENERATION_LIMIT' ? '재생성 횟수를 모두 썼어요 🥲'
        : code === 'PARTNER_NOT_JOINED' ? '연인이 아직 방에 들어오지 않았어요'
        : '생성에 실패했어요. 잠시 후 다시 시도해주세요',
      )
      return
    }
    setImageUrl(data.imageUrl)
    setRemaining(data.remaining)
    setStep('preview')
  }

  const confirmName = async () => {
    setBusy(true)
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      setBusy(false)
      setError('로그인이 만료됐어요. 새로고침 후 다시 시도해주세요')
      return
    }
    const { error: updateError } = await supabase
      .from('characters')
      .update({ name })
      .eq('owner_user_id', userData.user.id)
    if (updateError) {
      setBusy(false)
      setError('이름 저장에 실패했어요. 다시 시도해주세요')
      return
    }
    setBusy(false)
    onDone()
  }

  if (step === 'cards') {
    return (
      <div style={{ display: 'grid', gap: 12 }}>
        <h2>연인을 들려주세요 💌</h2>
        {QUESTIONS.map((q, i) => (
          <label key={q.id} style={{ display: 'grid', gap: 4, textAlign: 'left' }}>
            {q.title}
            <textarea
              placeholder={q.placeholder}
              value={answers[i]}
              onChange={(e) =>
                setAnswers(answers.map((a, j) => (j === i ? e.target.value : a)))
              }
            />
          </label>
        ))}
        <button disabled={busy || answers.every((a) => !a.trim())} onClick={generate}>
          {busy ? '분신을 그리는 중… 🎨' : '분신 만나러 가기'}
        </button>
        {error && <p style={{ color: 'crimson' }}>{error}</p>}
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gap: 12, textAlign: 'center' }}>
      <h2>연인의 분신이에요!</h2>
      {imageUrl && (
        <img src={imageUrl} alt="분신 미리보기"
          style={{ width: 240, margin: '0 auto', imageRendering: 'pixelated' }} />
      )}
      <button disabled={busy || remaining === 0} onClick={generate}>
        다시 그리기 (남은 횟수 {remaining ?? 0})
      </button>
      <input placeholder="이름 지어주기" value={name} onChange={(e) => setName(e.target.value)} />
      <button disabled={busy || !name.trim()} onClick={confirmName}>
        이 아이로 할래요 💕
      </button>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
    </div>
  )
}
