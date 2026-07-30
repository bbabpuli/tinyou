import { useEffect, useRef, useState } from 'react'
import { generateAvatar } from '../game/avatar'
import { drawPixelMap } from '../game/sprite'
import { supabase } from '../lib/supabase'
import { QUESTIONS } from './questions'

export function CharacterCreate({ onDone }: { onDone: () => void }): JSX.Element {
  const [answers, setAnswers] = useState<string[]>(QUESTIONS.map(() => ''))
  const [step, setStep] = useState<'cards' | 'preview'>('cards')
  const [busy, setBusy] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (step === 'preview' && canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d')
      if (ctx) {
        ctx.imageSmoothingEnabled = false
        ctx.clearRect(0, 0, 16, 16)
        const { map, palette } = generateAvatar(answers, attempt)
        drawPixelMap(ctx, map, palette, 0, 0, 1)
      }
    }
  }, [answers, attempt, step])

  const generate = () => {
    setStep('preview')
  }

  const confirmName = async () => {
    setBusy(true)
    setError(null)
    const canvas = canvasRef.current
    if (!canvas) {
      setBusy(false)
      return
    }
    const base64 = canvas.toDataURL('image/png').split(',')[1]
    const { data, error } = await supabase.functions.invoke('upload-character', {
      // avatarSeed: 같은 답변·salt면 동일한 도트가 재생성된다 — Plan 3 꾸미기의 기반 데이터
      body: { imageBase64: base64, name, avatarSeed: { answers, salt: attempt } },
    })
    setBusy(false)
    let code: string = data?.error ?? ''
    if (error && !code) {
      const ctx = (error as { context?: Response }).context
      if (ctx) {
        try {
          code = ((await ctx.json()) as { error?: string }).error ?? ''
        } catch {
          // 본문이 JSON이 아니면 일반 실패
        }
      }
    }
    if (error || code) {
      setError(
        code === 'GENERATION_LIMIT' ? '확정 가능 횟수를 모두 썼어요 🥲'
        : code === 'PARTNER_NOT_JOINED' ? '연인이 아직 방에 들어오지 않았어요'
        : '저장에 실패했어요. 잠시 후 다시 시도해주세요',
      )
      return
    }
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
      <canvas
        ref={canvasRef}
        width={16}
        height={16}
        style={{ width: 240, margin: '0 auto', imageRendering: 'pixelated' }}
      />
      <button disabled={busy} onClick={() => setAttempt((a) => a + 1)}>
        다시 뽑기
      </button>
      <input
        placeholder="이름 지어주기"
        value={name}
        maxLength={20}
        onChange={(e) => setName(e.target.value)}
      />
      <button disabled={busy || !name.trim()} onClick={confirmName}>
        이 아이로 할래요 💕
      </button>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
    </div>
  )
}
