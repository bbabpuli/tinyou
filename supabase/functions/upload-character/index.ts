import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'

const MAX_UPLOADS = 4 // 확정(업로드) 한도 — 로컬 미리보기는 무제한
const MAX_BYTES = 32 * 1024
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
const UNIQUE_VIOLATION = '23505'

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

// couple_id + owner_user_id 행에 대해 regen_count를 CAS(compare-and-swap)로 증가시킨다.
// 동시 요청 레이스에서 낙관적 락으로 캡(MAX_UPLOADS) 우회를 막는다.
async function tryClaimSlot(
  admin: SupabaseClient,
  id: string,
  used: number,
): Promise<'claimed' | 'lost'> {
  const { data, error } = await admin
    .from('characters')
    .update({ regen_count: used + 1 })
    .eq('id', id)
    .eq('regen_count', used)
    .select('id')
  if (error) throw error
  return data && data.length > 0 ? 'claimed' : 'lost'
}

// 업로드 한도 슬롯을 원자적으로 예약한다 (Storage 업로드 전에 반드시 완료).
// existing 행이 있으면 CAS update, 없으면 insert를 시도하고 유니크 충돌 시 update 경로로 폴백한다.
// name은 여기서 기록하지 않는다: Storage 업로드 실패 시 "name 있음 + image_path null"인
// 유령 행이 남으면 앱 라우팅(`!mine || !mine.name`)이 이를 완성된 캐릭터로 오인해
// CharacterCreate 재진입이 막히기 때문 — name은 Phase 2(업로드 성공 후)에서만 기록한다.
async function reserveUploadSlot(
  admin: SupabaseClient,
  coupleId: string,
  ownerId: string,
  subjectId: string,
  existing: { id: string; regen_count: number } | null,
): Promise<{ characterId: string } | { error: 'GENERATION_LIMIT' | 'SAVE_FAILED' }> {
  if (existing) {
    let id = existing.id
    let used = existing.regen_count
    if (used >= MAX_UPLOADS) return { error: 'GENERATION_LIMIT' }
    try {
      if ((await tryClaimSlot(admin, id, used)) === 'claimed') return { characterId: id }
    } catch (err) {
      console.error('slot claim error', err)
      return { error: 'SAVE_FAILED' }
    }
    // 동시 요청이 먼저 선점 — 최신 상태로 1회만 재시도
    const { data: fresh } = await admin
      .from('characters').select('id, regen_count')
      .eq('couple_id', coupleId).eq('owner_user_id', ownerId).maybeSingle()
    id = fresh?.id ?? id
    used = fresh?.regen_count ?? MAX_UPLOADS
    if (used >= MAX_UPLOADS) return { error: 'GENERATION_LIMIT' }
    try {
      return (await tryClaimSlot(admin, id, used)) === 'claimed'
        ? { characterId: id }
        : { error: 'GENERATION_LIMIT' }
    } catch (err) {
      console.error('slot claim retry error', err)
      return { error: 'SAVE_FAILED' }
    }
  }

  // 첫 업로드 — 아직 행이 없으므로 insert 시도 (regen_count=1로 슬롯까지 함께 예약)
  const newId = crypto.randomUUID()
  const { error: insertError } = await admin.from('characters').insert({
    id: newId,
    couple_id: coupleId,
    owner_user_id: ownerId,
    subject_user_id: subjectId,
    regen_count: 1,
  })
  if (!insertError) return { characterId: newId }
  if (insertError.code !== UNIQUE_VIOLATION) {
    console.error('slot insert error', insertError)
    return { error: 'SAVE_FAILED' }
  }
  // 동시 첫 업로드가 먼저 행을 만듦 — 그 행을 다시 읽어 update 경로로 폴백
  const { data: fresh } = await admin
    .from('characters').select('id, regen_count')
    .eq('couple_id', coupleId).eq('owner_user_id', ownerId).maybeSingle()
  if (!fresh) return { error: 'SAVE_FAILED' }
  return reserveUploadSlot(admin, coupleId, ownerId, subjectId, fresh)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })
  if (req.method !== 'POST') return json(405, { error: 'METHOD_NOT_ALLOWED' })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  })
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return json(401, { error: 'UNAUTHORIZED' })

  let payload: { imageBase64?: string; name?: string }
  try {
    payload = (await req.json()) as { imageBase64?: string; name?: string }
  } catch {
    return json(400, { error: 'BAD_REQUEST' })
  }
  const { imageBase64, name } = payload
  if (!imageBase64 || !name?.trim()) return json(400, { error: 'BAD_REQUEST' })

  let bytes: Uint8Array
  try {
    bytes = Uint8Array.from(atob(imageBase64), (c) => c.charCodeAt(0))
  } catch {
    return json(400, { error: 'BAD_REQUEST' })
  }
  if (bytes.length > MAX_BYTES) return json(413, { error: 'IMAGE_TOO_LARGE' })
  if (!PNG_MAGIC.every((b, i) => bytes[i] === b)) return json(415, { error: 'NOT_PNG' })

  const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  const { data: me } = await admin
    .from('profiles').select('couple_id').eq('user_id', user.id).single()
  if (!me?.couple_id) return json(403, { error: 'NO_COUPLE' })
  const { data: partner } = await admin
    .from('profiles').select('user_id')
    .eq('couple_id', me.couple_id).neq('user_id', user.id).maybeSingle()
  if (!partner) return json(403, { error: 'PARTNER_NOT_JOINED' })

  const { data: existing } = await admin
    .from('characters').select('id, regen_count')
    .eq('couple_id', me.couple_id).eq('owner_user_id', user.id).maybeSingle()

  const slot = await reserveUploadSlot(admin, me.couple_id, user.id, partner.user_id, existing)
  if ('error' in slot) return json(slot.error === 'GENERATION_LIMIT' ? 429 : 502, { error: slot.error })
  const { characterId } = slot

  const imagePath = `${characterId}/${crypto.randomUUID()}.png`
  const { error: uploadError } = await admin.storage
    .from('characters')
    .upload(imagePath, bytes, { contentType: 'image/png' })
  if (uploadError) {
    console.error('upload error', uploadError)
    // 슬롯(regen_count)은 이미 소모됨 — 업로드 실패 시에도 복구하지 않고 그대로 소진 처리
    // (재시도 시 사용자는 남은 한도로 다시 시도하게 된다)
    return json(502, { error: 'UPLOAD_FAILED' })
  }

  const { error: updateError } = await admin.from('characters')
    .update({ image_path: imagePath, name: name.trim() })
    .eq('id', characterId)
  if (updateError) {
    console.error('image_path update error', updateError)
    return json(502, { error: 'SAVE_FAILED' })
  }

  const { data: pub } = admin.storage.from('characters').getPublicUrl(imagePath)
  return json(200, { imageUrl: pub.publicUrl })
})
