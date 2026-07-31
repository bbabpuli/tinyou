import { createClient } from 'npm:@supabase/supabase-js@2'
import Anthropic from 'npm:@anthropic-ai/sdk@0.115.0'

const MAX_TOTAL_CHARS = 2000 // 답변 합계 상한 — 남용·비용 가드
const MODEL = 'claude-haiku-4-5'

const SPECIES_KEYS = [
  'hamster', 'rabbit', 'cat', 'dog', 'squirrel', 'frog',
  'bird', 'axolotl', 'bear', 'penguin', 'duck', 'seal',
] as const
const PALETTE_KEYS = [
  'pink', 'mint', 'lavender', 'peach', 'sky', 'lemon', 'cream', 'taupe',
] as const

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

const SYSTEM_PROMPT = `너는 연인 묘사를 읽고 그 사람과 가장 어울리는 픽셀 동물 캐릭터를 고르는 큐레이터다.
키워드 표면 매칭이 아니라 묘사 전체의 인상(성격·분위기·체형·습관)으로 판단한다.
단, 답변이 동물을 직접 지목하면(예: "햄스터 같아") 그 동물을 우선한다.

종(species) 후보와 성격:
- hamster: 작고 통통, 볼이 빵빵, 먹는 걸 좋아함, 부지런히 오물오물
- rabbit: 여리고 순함, 겁 많음, 깡총거리는 생기
- cat: 도도하고 독립적, 츤데레, 우아함
- dog: 사교적이고 다정함, 반겨줌, 충직하고 해맑음
- squirrel: 재빠르고 야무짐, 알뜰살뜰 챙김, 호기심
- frog: 엉뚱하고 낙천적, 개성 강함, 통통 튐
- bird: 수다스럽고 명랑함, 아침형, 지저귀듯 조잘조잘
- axolotl: 몽글몽글 신비함, 무표정 속 귀여움, 마이페이스
- bear: 듬직하고 포근함, 큰 덩치, 안기고 싶은 안정감, 잠 많음
- penguin: 뒤뚱뒤뚱 성실함, 추위에 강한 꾸준함, 단체생활
- duck: 태평하고 유유자적, 물 흐르듯 느긋함, 꽥 하고 웃김
- seal: 물살처럼 부드러움, 통통하고 매끈, 애교 많고 잘 웃음

팔레트(palette) 후보와 인상:
- pink: 분홍 — 사랑스럽고 발랄
- mint: 민트·연두 — 싱그럽고 상쾌
- lavender: 연보라 — 차분하고 몽환적
- peach: 살구·주황 — 따뜻하고 활기참
- sky: 하늘·파랑 — 시원하고 맑음
- lemon: 노랑 — 밝고 햇살 같음
- cream: 흰색·아이보리 — 순하고 포근
- taupe: 갈색·회갈 — 듬직하고 차분

반드시 위 키 문자열 그대로 species 하나, palette 하나를 고른다.`

const OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    species: { type: 'string', enum: [...SPECIES_KEYS] },
    palette: { type: 'string', enum: [...PALETTE_KEYS] },
  },
  required: ['species', 'palette'],
  additionalProperties: false,
} as const

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })
  if (req.method !== 'POST') return json(405, { error: 'METHOD_NOT_ALLOWED' })

  let user
  try {
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
    )
    const { data } = await userClient.auth.getUser()
    user = data.user
  } catch {
    return json(500, { error: 'INTERNAL_ERROR' })
  }
  if (!user) return json(401, { error: 'UNAUTHORIZED' })

  let payload: { answers?: unknown }
  try {
    payload = (await req.json()) as { answers?: unknown }
  } catch {
    return json(400, { error: 'BAD_REQUEST' })
  }
  const answers = payload.answers
  if (!Array.isArray(answers) || answers.some((a) => typeof a !== 'string')) {
    return json(400, { error: 'BAD_REQUEST' })
  }
  const texts = (answers as string[]).map((a) => a.trim()).filter(Boolean)
  const total = texts.reduce((n, t) => n + t.length, 0)
  if (texts.length === 0 || total > MAX_TOTAL_CHARS) return json(400, { error: 'BAD_REQUEST' })

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) return json(503, { error: 'MAPPING_UNAVAILABLE' })

  const anthropic = new Anthropic({ apiKey, timeout: 10_000, maxRetries: 1 })
  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      output_config: { format: { type: 'json_schema', schema: OUTPUT_SCHEMA } },
      messages: [{ role: 'user', content: `연인 묘사:\n${texts.join('\n')}` }],
    })
    const textBlock = response.content.find(
      (b): b is Extract<(typeof response.content)[number], { type: 'text' }> => b.type === 'text',
    )
    const text = textBlock?.text
    if (!text) return json(502, { error: 'MAPPING_FAILED' })
    const mapping = JSON.parse(text) as { species: string; palette: string }
    // 스키마 강제로 이미 enum이 보장되지만, 서버가 최종 권위로 한 번 더 확인
    if (
      !(SPECIES_KEYS as readonly string[]).includes(mapping.species) ||
      !(PALETTE_KEYS as readonly string[]).includes(mapping.palette)
    ) {
      return json(502, { error: 'MAPPING_FAILED' })
    }
    return json(200, mapping)
  } catch {
    // 답변 원문은 로그에 남기지 않는다 (프라이버시)
    return json(502, { error: 'MAPPING_FAILED' })
  }
})
