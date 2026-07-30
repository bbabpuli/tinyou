import { useEffect, useRef, useState } from 'react'
import { generateAvatar } from '../game/avatar'
import { drawPixelMap } from '../game/sprite'
import { QUESTIONS } from './questions'

export function CharacterCreate({ onDone }: { onDone: () => void }): JSX.Element {
  const [answers, setAnswers] = useState<string[]>(QUESTIONS.map(() => ''))
  const [step, setStep] = useState<'cards' | 'preview'>('cards')
  const [busy] = useState(false)
  const [name, setName] = useState('')
  const [error] = useState<string | null>(null)
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
    // Task 12: upload-character 연결
    // onDone will be called after character is uploaded
    void onDone
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
      <input placeholder="이름 지어주기" value={name} onChange={(e) => setName(e.target.value)} />
      <button disabled={busy || !name.trim()} onClick={confirmName}>
        이 아이로 할래요 💕
      </button>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
    </div>
  )
}
